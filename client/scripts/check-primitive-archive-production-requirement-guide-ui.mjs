import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createHandlerHarness, elements, textOf } from './lib/hook-handler-harness.mjs';

const root = new URL('../', import.meta.url);
const componentRoot = new URL('src/app/games/primitive-archive/_components/', root).href;
const sharedRoot = new URL('src/app/games/_components/', root).href;
const playUrl = new URL('PrimitiveArchivePlayContent.js', componentRoot);
globalThis.__productionGuideReact = React;
const hooks = `export function useState(initial) {
  const harness = globalThis.__productionGuideDraft;
  if (!harness) return globalThis.__productionGuideReact.useState(initial);
  const index = harness.cursor++;
  if (!(index in harness.values)) harness.values[index] = typeof initial === 'function' ? initial() : initial;
  return [harness.values[index], value => { harness.values[index] = typeof value === 'function' ? value(harness.values[index]) : value; }];
}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react' && context.parentURL === componentRoot + 'PrimitiveArchiveWorldMap.js') {
      return { url: new URL('./lib/hook-handler-harness.mjs', import.meta.url).href, shortCircuit: true };
    }
    if (specifier === 'react' && ['PrimitiveArchiveProcessingPlan.js', 'PrimitiveArchiveEducationPlan.js'].some(name => context.parentURL === componentRoot + name)) {
      return { url: `data:text/javascript,${encodeURIComponent(hooks)}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!(url.startsWith(componentRoot) || url.startsWith(sharedRoot)) || !url.endsWith('.js')) return next(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
  },
});
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { productionRequirementGuide } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProductionRequirementGuide.js');
const { campRequirementGuide } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCampRequirementGuide.js');
const { default: Processing } = await import(componentRoot + 'PrimitiveArchiveProcessingPlan.js');
const { default: Education } = await import(componentRoot + 'PrimitiveArchiveEducationPlan.js');
const { default: Guide } = await import(componentRoot + 'PrimitiveArchiveProductionRequirementGuide.js');
const { default: WorldMap } = await import(componentRoot + 'PrimitiveArchiveWorldMap.js');
const fresh = () => {
  const state = engine.createNewState({ runId: 'production-guide-ui-fresh', now: '2026-11-12T00:00:00.000Z', rng: () => 0.5 });
  state.tribe.processingPlan = { actionId: 'forge', targetStock: 99 };
  state.tribe.educationPlan = { teachers: 1 };
  state.inventory = {}; return state;
};
const dataFor = state => {
  const processing = engine.tribeProcessingSummary(state), education = engine.tribeEducationSummary(state), regions = engine.regionRows(state);
  return { processing, education, regions, guide: productionRequirementGuide({ processing, education, regions }) };
};
function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { type: node.type, props: { ...node.props, children: expand(node.props?.children) } };
}
function withDraft(run) {
  const harness = { cursor: 0, values: [] }; globalThis.__productionGuideDraft = harness;
  try { return run(harness); } finally { delete globalThis.__productionGuideDraft; }
}
function pageHandler(name, bindings) {
  const source = ts.createSourceFile('PrimitiveArchivePlayContent.js', readFileSync(playUrl, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(initializer, `Missing actual page callback ${name}`);
  if (ts.isCallExpression(initializer) && initializer.expression.getText(source) === 'useCallback') initializer = initializer.arguments[0];
  return new Function(...Object.keys(bindings), `return (${initializer.getText(source)});`)(...Object.values(bindings));
}
let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };

check('actual guide renders native disclosure and keyboard buttons with exact scoped requests at AP zero and after ending', () => {
  for (const ended of [false, true]) {
    const state = fresh(); state.ap = 0; state.ended = ended;
    const before = structuredClone(state), { guide } = dataFor(state), requests = [];
    for (const scope of ['processing', 'education']) {
      const tree = expand(Guide({ guide: guide[scope], scope, onOpenRequirementHelp: request => requests.push(request) }));
      assert.ok(elements(tree, node => node.type === 'details').length);
      assert.equal(elements(tree, node => node.type === 'summary').length, 1);
      for (const button of elements(tree, node => node.type === 'button')) {
        assert.equal(button.props.type, 'button'); assert.ok(!button.props.disabled); assert.notEqual(button.props.tabIndex, -1);
        assert.ok(textOf(button)); button.props.onClick();
      }
    }
    assert.ok(requests.some(row => row.kind === 'map'));
    assert.ok(requests.some(row => row.kind === 'research'));
    assert.ok(requests.every(row => ['processing', 'education'].includes(row.scope)));
    assert.ok(requests.filter(row => row.kind === 'map').every(row => row.sourceKind && row.actionId && row.resourceId && row.regionId));
    assert.deepEqual(state, before);
  }
});

check('actual SSR keeps education supply separate from invented demand and produces nonempty accessible text', () => {
  const state = fresh(), { guide, processing, education } = dataFor(state);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(Processing, { processing, requirementGuide: guide.processing, onConfigure() {}, onOpenRequirementHelp() {} }),
    React.createElement(Education, { education, requirementGuide: guide.education, onConfigure() {}, onOpenRequirementHelp() {} })));
  assert.match(html, /<details/); assert.match(html, /<summary/); assert.match(html, /공급/);
  assert.doesNotMatch(html, /NaN|undefined|Infinity|부족\s*null|null\s*장/);
  assert.ok(html.includes('제련') && html.includes('제지'));
});

check('unsaved production and education drafts keep the saved guide and do not configure from help', () => {
  const state = fresh(), { guide, processing, education } = dataFor(state), before = structuredClone(state);
  for (const [Component, props, change] of [
    [Processing, { processing, requirementGuide: guide.processing }, tree => elements(tree, node => node.type === 'select')[0].props.onChange({ target: { value: 'paper' } })],
    [Education, { education, requirementGuide: guide.education }, tree => elements(tree, node => node.type === 'input' && node.props.type === 'number')[0].props.onChange({ target: { value: '9' } })],
  ]) withDraft(harness => {
    let configured = 0;
    const render = () => { harness.cursor = 0; return expand(Component({ ...props, onConfigure: () => configured++, onOpenRequirementHelp() {} })); };
    let tree = render(); const initialGuides = elements(tree, node => node.type === 'details').map(textOf);
    change(tree); tree = render();
    assert.deepEqual(elements(tree, node => node.type === 'details').map(textOf), initialGuides);
    assert.equal(configured, 0);
  });
  assert.deepEqual(state, before);
});

check('actual page callback accepts only current scoped field and nested processing routes without changing gameplay', () => {
  for (const ended of [false, true]) {
    const state = fresh(); state.ap = 0; state.ended = ended;
    const before = structuredClone(state), stateRef = { current: state }, actorId = state.party[0].id;
    const actorSelectionRef = { current: actorId }, tribe = engine.tribeSummary(state), requests = [];
    let tab, gameplayWrites = 0;
    const handler = pageHandler('openRequirementHelp', { ...engine, state, stateRef, actorId, actorSelectionRef, tribe,
      regions: engine.regionRows(state), campActions: engine.campActionRows(state), campFacilities: engine.campFacilityRows(state),
      campRequirementGuide, productionRequirementGuide,
      setRequirementHelpRequest: value => requests.push(value), setActiveTabId: value => { tab = value; },
      applyAction: () => { gameplayWrites++; throw new Error('Help invoked gameplay action'); },
      setState: () => { gameplayWrites++; throw new Error('Help replaced gameplay state'); } });
    const { guide, regions: currentRegions } = dataFor(state), offered = [];
    const hidden = currentRegions.find(row => !row.revealed);
    for (const scope of ['processing', 'education']) {
      const collect = rows => rows.forEach(material => material.sources.forEach(source => {
        if (source.regionId) offered.push({ kind: 'map', scope, resourceId: material.resourceId,
          regionId: source.regionId, sourceKind: source.kind, actionId: source.actionId });
        for (const technology of source.research || []) if (!technology.completed) offered.push({ kind: 'research', scope, technologyId: technology.technologyId });
        collect(source.materialRows || []);
      }));
      collect(guide[scope].materials);
      for (const technology of guide[scope].research) if (!technology.completed) offered.push({ kind: 'research', scope, technologyId: technology.technologyId });
    }
    assert.ok(offered.some(row => row.kind === 'map'));
    assert.ok(offered.some(row => row.kind === 'research'));
    const random = Math.random; Math.random = () => { throw new Error('Help consumed RNG'); };
    try {
      for (const request of offered) {
        const count = requests.length; handler(request); assert.equal(requests.length, count + 1);
        assert.equal(tab, request.kind === 'map' ? 'map' : 'growth');
        assert.equal(requests.at(-1).runId, state.runId);
        if (request.kind === 'map') for (const key of ['scope', 'sourceKind', 'actionId']) assert.equal(requests.at(-1)[key], request[key]);
      }
      const accepted = requests.length, map = offered.find(row => row.kind === 'map');
      for (const invalid of [null, {}, { ...map, scope: 'fabricated' }, { ...map, sourceKind: 'invented' },
        { ...map, actionId: 'invented' }, { ...map, resourceId: 'paper' },
        { ...map, regionId: hidden.id }, { ...map, regionId: 'fabricated' },
        { kind: 'research', scope: 'education', technologyId: 'PUBLIC_EDUCATION' },
        { kind: 'research', scope: 'processing', technologyId: 'fabricated' }]) handler(invalid);
      assert.equal(requests.length, accepted);
      stateRef.current = { ...state, runId: 'restored-other-run' }; handler(map); assert.equal(requests.length, accepted);
      stateRef.current = { ...state }; handler(map); assert.equal(requests.length, accepted);
      stateRef.current = state; actorSelectionRef.current = 'different-actor'; handler(map); assert.equal(requests.length, accepted);
      actorSelectionRef.current = actorId;
      const saved = tribe.processing.plan; tribe.processing.plan = { ...saved, targetStock: saved.targetStock + 1 };
      handler(map); assert.equal(requests.length, accepted); tribe.processing.plan = saved;
      const source = state.tribe.processingPlan;
      state.tribe.processingPlan = { actionId: 'kiln', targetStock: 3 };
      handler(map); assert.equal(requests.length, accepted); state.tribe.processingPlan = source;
    } finally { Math.random = random; }
    assert.equal(gameplayWrites, 0); assert.deepEqual(state, before);
  }
});

check('actual map displays specialized nested acquisition, matching action and research, with focus and no automatic selection', () => {
  const state = fresh(); state.tribe.processingPlan = { actionId: 'smelt', targetStock: 3 };
  state.exploration.revealed = Object.fromEntries(engine.WORLD_REGIONS.map(row => [row.id, true]));
  const { regions, guide } = dataFor(state), tribe = engine.tribeSummary(state), before = structuredClone(state);
  const material = guide.processing.materials.find(row => row.resourceId === 'metal_ore');
  const source = material.sources.find(row => row.kind === 'specialized' && row.actionId === 'mine'); assert.ok(source);
  const request = { kind: 'map', scope: 'processing', resourceId: material.resourceId, resourceName: material.name,
    regionId: source.regionId, sourceKind: source.kind, actionId: source.actionId, runId: state.runId };
  for (const selectionUnlocked of [false, true]) {
    let selections = 0;
    const props = { regions, tribe, exploration: engine.explorationSummary(state), selectedRegion: regions.find(row => row.selected),
      selectionUnlocked, mapHelpRequest: request, onSelect: () => selections++ };
    const harness = createHandlerHarness(WorldMap, props), tree = harness.render();
    const notes = elements(tree, node => node.props?.role === 'note'); assert.equal(notes.length, 1);
    assert.ok(textOf(notes[0]).includes(source.actionLabel));
    if (!selectionUnlocked) {
      assert.ok(textOf(notes[0]).includes('행동 화면에서 실제 대상 지역을 확인'));
      assert.ok(textOf(notes[0]).includes('지형에 맞는 발견 지역'));
      assert.ok(!textOf(notes[0]).includes('무작위'));
    }
    for (const technology of source.research.filter(row => !row.completed)) assert.ok(textOf(notes[0]).includes(technology.name));
    assert.equal(elements(tree, node => node.type === 'button' && String(node.props.className).includes('is-requirement-help')).length, 1);
    const heading = elements(tree, node => node.type === 'h3' && node.props.ref)[0]; assert.ok(heading); assert.equal(heading.props.tabIndex, -1);
    const calls = []; heading.props.ref.current = { focus: options => calls.push(['focus', options]), scrollIntoView: options => calls.push(['scroll', options]) };
    for (const effect of harness.effects) effect();
    assert.deepEqual(calls.map(row => row[0]), ['focus', 'scroll']); assert.equal(selections, 0);
    for (const invalid of [{ ...request, sourceKind: 'gather' }, { ...request, actionId: 'invented' },
      { ...request, regionId: 'fabricated' }, { ...request, resourceId: 'paper' }]) {
      const invalidTree = createHandlerHarness(WorldMap, { ...props, mapHelpRequest: invalid }).render();
      assert.equal(elements(invalidTree, node => node.props?.role === 'note').length, 0);
    }
    const hiddenRegions = regions.map(row => row.id === source.regionId ? { ...row, revealed: false } : row);
    assert.equal(elements(createHandlerHarness(WorldMap, { ...props, regions: hiddenRegions }).render(), node => node.props?.role === 'note').length, 0);
  }
  assert.deepEqual(state, before);
});

check('locked map retains random-region guidance for real camp and scoped gather or hunt help', () => {
  const state = fresh();
  state.tribe.processingPlan = { actionId: 'preserve', targetStock: 3 };
  state.exploration.revealed = Object.fromEntries(engine.WORLD_REGIONS.map(row => [row.id, true]));
  const { regions, guide } = dataFor(state), tribe = engine.tribeSummary(state), requests = [];
  for (const kind of ['gather', 'hunt']) {
    const material = guide.processing.materials.find(row => row.sources.some(source => source.kind === kind));
    assert.ok(material, `Missing actual ${kind} material route`);
    const source = material.sources.find(row => row.kind === kind);
    requests.push({ kind: 'map', scope: 'processing', sourceKind: kind, actionId: source.actionId,
      regionId: source.regionId, resourceId: material.resourceId, resourceName: material.name });
    requests.push({ kind: 'map', regionId: source.regionId, resourceId: material.resourceId, resourceName: material.name });
  }
  for (const request of requests) {
    const tree = createHandlerHarness(WorldMap, { regions, tribe, exploration: engine.explorationSummary(state),
      selectionUnlocked: false, mapHelpRequest: request, onSelect: () => { throw new Error('Help selected a region'); } }).render();
    const notes = elements(tree, node => node.props?.role === 'note'); assert.equal(notes.length, 1);
    assert.ok(textOf(notes[0]).includes('탐사된 지역 중 무작위로 행동합니다.'));
    assert.ok(!textOf(notes[0]).includes('행동 화면에서 실제 대상 지역을 확인'));
  }
});

console.log(JSON.stringify({ pass: true, checks, scope: 'Actual components, actual React SSR and current page callback AST; no browser, visual acceptance or gameplay mutation claim.' }));
