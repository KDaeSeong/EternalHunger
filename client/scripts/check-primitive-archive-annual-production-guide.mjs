import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import './lib/register-simulation-modules.mjs';

const require = createRequire(new URL('../package.json', import.meta.url));
const React = require('react');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const componentUrl = new URL('../src/app/games/primitive-archive/_components/PrimitiveArchiveProductionRequirementGuide.js', import.meta.url);
registerHooks({ load(url, context, next) {
  if (url !== componentUrl.href) return next(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(componentUrl, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { productionRequirementGuide } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProductionRequirementGuide.js');
const { default: Guide } = await import(componentUrl);
let passed = 0;
const failures = [];
function check(name, run) {
  try { run(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.stack || error.message}`); }
}
function fresh(id, annualMode = true) {
  let state = engine.createNewState({ runId: id, now: '2026-11-12T00:00:00.000Z', rng: () => 0.5 });
  Object.assign(state.research.completed, { SETTLEMENT: true, FOOD_STORAGE: true });
  state.camp.shelterLevel = 1;
  state.inventory = { berry: 2, wood: 0, fiber: 0, metal_ore: 0, metal_ingot: 0, paper: 0, herb: 0 };
  state.tribe.processingPlan = { actionId: 'smelt', targetStock: 5 };
  state.tribe.educationPlan = { teachers: 1 };
  state.exploration.revealed = Object.fromEntries(engine.WORLD_REGIONS.map(region => [region.id, true]));
  if (annualMode) state = engine.startAnnualSettlementAction(state, { runId: state.runId, day: state.day,
    ap: state.ap, updatedAt: state.updatedAt, completedYears: null });
  return state;
}
const summaries = state => ({ processing: engine.tribeProcessingSummary(state),
  education: engine.tribeEducationSummary(state), regions: engine.regionRows(state) });
function materialTree(rows) {
  return rows.flatMap(row => [row, ...(row.sources || []).flatMap(source => materialTree(source.materialRows || []))]);
}
function sourceTree(guide) {
  return [...materialTree(guide.processing.materials), ...materialTree(guide.education.materials)].flatMap(row => row.sources || []);
}
const render = (guide, scope, onOpenRequirementHelp = () => {}) => renderToStaticMarkup(React.createElement(Guide,
  { guide: guide[scope], scope, onOpenRequirementHelp }));
function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { ...node, props: { ...node.props, children: React.Children.toArray(node.props?.children).map(expand) } };
}
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value); Object.values(value).forEach(freeze); return value;
}

check('real annual metal-ore help points only to the actual mining workforce capability and research', () => {
  const state = fresh('annual-guide-ore');
  const input = summaries(state), guide = productionRequirementGuide(input);
  assert.equal(input.processing.annualMode, true);
  assert.equal(guide.processing.annualMode, true); assert.equal(guide.education.annualMode, true);
  const ore = guide.processing.materials.find(row => row.resourceId === 'metal_ore');
  assert.equal(ore.required, 2, 'existing actual one-batch smelting cost');
  const route = ore.sources.find(source => source.actionId === 'miner');
  assert.ok(route); assert.equal(route.kind, 'community'); assert.equal(route.actionLabel, '채광대');
  assert.ok(route.research.some(row => row.technologyId === 'MINING' && row.completed === false));
  assert.ok(sourceTree(guide).every(source => ['community', 'production'].includes(source.kind)));
  for (const source of sourceTree(guide).filter(row => row.kind === 'community')) {
    assert.ok(!('regionId' in source) && !('regionName' in source) && !('dangerLabel' in source));
    assert.ok(!('quantity' in source) && !('outputQuantity' in source) && !('chance' in source) && !('probability' in source));
  }
});

check('education paper keeps the actual single production step and community wood/fiber supply without invented demand', () => {
  const state = fresh('annual-guide-paper');
  const input = summaries(state), guide = productionRequirementGuide(input);
  const paper = guide.education.materials.find(row => row.resourceId === 'paper');
  assert.equal(paper.supplyOnly, true); assert.equal(paper.required, null); assert.equal(paper.missing, null);
  const production = paper.sources.find(source => source.kind === 'production' && source.actionId === 'paper');
  assert.ok(production); assert.equal(production.outputQuantity, 2);
  assert.deepEqual(production.materialRows.map(row => [row.resourceId, row.required]).sort(), [['fiber', 1], ['wood', 1]]);
  for (const material of production.materialRows) {
    assert.ok(material.sources.some(source => source.kind === 'community' && source.actionId === 'forager'));
    assert.ok(material.sources.every(source => source.kind === 'community'), 'raw recipe inputs do not recurse further');
  }
  assert.ok(production.research.some(row => row.technologyId === 'PAPERMAKING' && !row.completed));
  for (const material of materialTree(guide.education.materials)) for (const source of material.sources) {
    if (source.kind !== 'community') continue;
    assert.ok(input.processing.communitySources.find(job => job.id === source.actionId)?.resourceIds.includes(material.resourceId));
  }
});

check('actual annual JSX has community job names and next-year education, no personal or map controls', () => {
  const guide = productionRequirementGuide(summaries(fresh('annual-guide-ssr')));
  for (const scope of ['processing', 'education']) {
    const html = render(guide, scope);
    assert.match(html, /공동체 직업/); assert.match(html, /직업 배치/);
    assert.match(html, /현재 생산량이나 다음 정산의 획득을 보장하지 않습니다/);
    assert.doesNotMatch(html, /지도에서 확인|발견한 지역|지도 제작 전|행동 성공|같은 아침|다음 날 교육/);
    assert.doesNotMatch(html, /NaN|undefined|Infinity/);
  }
  assert.match(render(guide, 'processing'), /채광대/);
  assert.match(render(guide, 'education'), /올해 가공에서 생산한 종이는 다음 연간 교육부터 사용/);
  assert.match(render(guide, 'education'), /제지/);
});

check('actual annual research buttons keep exact scoped read-only requests, including nested raw supplies', () => {
  const guide = productionRequirementGuide(summaries(fresh('annual-guide-buttons')));
  const requests = [];
  for (const scope of ['processing', 'education']) {
    const tree = expand(Guide({ guide: guide[scope], scope, onOpenRequirementHelp: request => requests.push(request) }));
    const buttons = nodes(tree, node => node.type === 'button');
    assert.ok(buttons.length > 0);
    for (const button of buttons) { assert.equal(button.props.type, 'button'); button.props.onClick(); }
  }
  assert.ok(requests.some(request => request.technologyId === 'MINING'));
  assert.ok(requests.some(request => request.technologyId === 'PAPERMAKING'));
  assert.ok(requests.every(request => request.kind === 'research' && ['processing', 'education'].includes(request.scope)));
});

check('capability routes do not depend on current workers or discovered places and never fabricate unsupported jobs', () => {
  const state = fresh('annual-guide-capability');
  const input = summaries(state);
  const all = productionRequirementGuide(input);
  const hidden = productionRequirementGuide({ ...input, regions: [] });
  assert.deepEqual(hidden, all, 'annual route availability is not a personal region-discovery check');
  assert.equal(state.tribe.assignments.miner, 0);
  const ore = all.processing.materials.find(row => row.resourceId === 'metal_ore');
  assert.ok(ore.sources.some(source => source.actionId === 'miner'), 'capability does not promise an existing assignment');
  const forged = productionRequirementGuide({ ...input, processing: { ...input.processing,
    communitySources: [{ id: 'invented-job', label: 'fictional free ore', resourceIds: ['metal_ore'], researchRequirements: [] }] } });
  assert.deepEqual(forged.processing.materials.find(row => row.resourceId === 'metal_ore').sources, []);
  assert.match(render(forged, 'processing'), /현재 공동체 직업 생산에서 확인된 공급 경로가 없습니다/);
});

check('annual actual summaries, helper, JSX and research callbacks preserve the frozen state and random stream', () => {
  const state = fresh('annual-guide-purity');
  state.inventory.metal_ore = 0.25;
  const before = structuredClone(state); freeze(state);
  const originalRandom = Math.random; let draws = 0;
  Math.random = () => { draws += 1; throw new Error('Read-only annual help consumed random'); };
  try {
    const input = summaries(state), inputBefore = structuredClone(input); freeze(input);
    const guide = productionRequirementGuide(input);
    const ore = guide.processing.materials.find(row => row.resourceId === 'metal_ore');
    assert.equal(ore.current, 0.25); assert.equal(ore.missing, 1.75);
    for (const scope of ['processing', 'education']) {
      render(guide, scope);
      const tree = expand(Guide({ guide: guide[scope], scope, onOpenRequirementHelp() {} }));
      nodes(tree, node => node.type === 'button').forEach(button => button.props.onClick());
    }
    assert.deepEqual(state, before); assert.deepEqual(input, inputBefore);
    assert.equal(draws, 0);
  } finally { Math.random = originalRandom; }
});

check('daily actual guide retains personal field/mining sources, map buttons and its original education timing', () => {
  const state = fresh('daily-guide-preservation', false), before = structuredClone(state);
  const input = summaries(state), guide = productionRequirementGuide(input);
  assert.equal(Object.hasOwn(input.processing, 'annualMode'), false);
  assert.equal(Object.hasOwn(guide.processing, 'annualMode'), false);
  assert.equal(Object.hasOwn(guide.education, 'annualMode'), false);
  assert.ok(sourceTree(guide).some(source => source.kind === 'specialized' && source.actionId === 'mine'));
  assert.ok(sourceTree(guide).some(source => source.kind === 'gather'));
  assert.ok(sourceTree(guide).every(source => source.kind !== 'community'));
  assert.match(render(guide, 'processing'), /지도에서 확인/);
  assert.match(render(guide, 'education'), /같은 아침에 생산한 종이는 다음 날 교육부터 사용/);
  assert.deepEqual(state, before);
});

console.log(`RESULT ${passed}/${passed + failures.length} passed; ${failures.length} failed; actual fresh summaries/helper/JSX, no browser or economic acceptance claim`);
if (failures.length) process.exitCode = 1;
