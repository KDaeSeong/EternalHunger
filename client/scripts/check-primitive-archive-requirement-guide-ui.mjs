import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import postcss from 'postcss';
import { createHandlerHarness, elements, textOf } from './lib/hook-handler-harness.mjs';

const root = new URL('../', import.meta.url);
const componentRoot = new URL('src/app/games/primitive-archive/_components/', root).href;
const sharedRoot = new URL('src/app/games/_components/', root).href;
const growthUrl = new URL('PrimitiveArchiveGrowthTab.js', componentRoot).href;
const previewUrl = new URL('PrimitiveArchiveResearchTreePreview.js', componentRoot).href;
const mapUrl = new URL('PrimitiveArchiveWorldMap.js', componentRoot).href;
const campUrl = new URL('PrimitiveArchiveCampWorkspace.js', componentRoot).href;
const playUrl = new URL('PrimitiveArchivePlayContent.js', componentRoot);
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (!(url.startsWith(componentRoot) || url.startsWith(sharedRoot)) || !url.endsWith('.js')) return nextLoad(url, context);
  let source = readFileSync(new URL(url), 'utf8');
  // Keep every production component. Only its React hook lifecycle is modeled.
  if ([growthUrl, previewUrl, mapUrl].includes(url)) source = source.replace("from 'react';", `from '${harnessUrl}';`);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText };
} });
const [{ default: Camp }, { default: Growth }, engine, runtime] = await Promise.all([
  import(campUrl), import(growthUrl),
  import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js'),
  import('../src/app/games/primitive-archive/_lib/primitiveArchivePageRuntime.js'),
]);
const [{ default: Preview }, { default: WorldMap }] = await Promise.all([import(previewUrl), import(mapUrl)]);
const { campRequirementGuide } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCampRequirementGuide.js');
const { productionRequirementGuide } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProductionRequirementGuide.js');
const fresh = () => engine.createNewState({ runId: 'requirement-guide-ui-fresh', now: '2026-11-02T00:00:00.000Z', rng: () => 0.5 });
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};
// Expand actual child components so disabled-button ancestry is testable.
function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { type: node.type, props: { ...node.props, children: expand(node.props?.children) } };
}
const campProps = (state, extra = {}) => ({ state, actor: state.party[0], canAct: state.ap > 0 && !state.ended,
  campActions: engine.campActionRows(state), campFacilities: engine.campFacilityRows(state),
  exploration: engine.explorationSummary(state), runProgressReport: engine.getRunProgressReport(state),
  runCamp() {}, runEventChain() {}, runRecoveryChoice() {}, recentActionText: '기존 캠프 결과', ...extra });
const growthProps = (state, extra = {}) => {
  const techs = engine.techRows(state), civicAdvancements = engine.civicRows(state);
  return { state, canAct: !state.ended && state.ap > 0, busy: false, hydrated: true,
    research: engine.researchSummary(state), civics: engine.civicsSummary(state), techs, civicAdvancements,
    researchMap: runtime.buildResearchMap(techs), civicMap: runtime.buildResearchMap(civicAdvancements),
    inspirationRows: engine.researchInspirationRows(state), civicInspirationRows: engine.civicsInspirationRows(state),
    technologyPlannerRows: engine.researchPlannerRows(state), civicPlannerRows: engine.civicsPlannerRows(state),
    priorityPlannerRows: [], priorityCivicRows: [], perks: [], projects: [],
    selectedResearchHelp: '기존 선택 연구 설명', selectedCivicHelp: '기존 제도 설명',
    selectResearchTarget() {}, selectCivicTarget() {}, runResearch() {}, runCivic() {}, ...extra };
};
const unlockGrowth = state => { state.camp.fireLevel = 1; state.camp.shelterLevel = 1; state.camp.workbenchLevel = 1; return state; };
const currentPage = () => {
  const text = readFileSync(playUrl, 'utf8');
  return ts.createSourceFile('PrimitiveArchivePlayContent.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
};
function pageHandler(name, bindings) {
  const source = currentPage(); let initializer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(initializer, `Missing actual page handler ${name}`);
  if (ts.isCallExpression(initializer) && initializer.expression.getText(source) === 'useCallback') initializer = initializer.arguments[0];
  return new Function(...Object.keys(bindings), `return (${initializer.getText(source)});`)(...Object.values(bindings));
}
let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };

check('real camp help stays native keyboard-accessible outside disabled execution controls at AP zero and after ending', () => {
  for (const changes of [{ ap: 0 }, { ap: 0, ended: true }]) {
    const state = Object.assign(fresh(), changes), before = JSON.stringify(state), requests = [];
    const tree = expand(Camp(campProps(freeze(state), { onOpenRequirementHelp: request => requests.push(request) })));
    const guides = elements(tree, node => node.type === 'details' && node.props.className === 'primitive-requirement-guide');
    assert.ok(guides.length > 0);
    for (const guide of guides) {
      assert.equal(elements(guide, node => node.type === 'summary').length, 1);
      for (const button of elements(guide, node => node.type === 'button')) {
        assert.equal(button.props.type, 'button'); assert.ok(!button.props.disabled);
        assert.notEqual(button.props.tabIndex, -1); button.props.onClick();
      }
    }
    for (const button of elements(tree, node => node.type === 'button' && String(node.props.className || '').includes('tcg-primary-action'))) {
      assert.equal(button.props.disabled, true);
      assert.equal(elements(button, node => node.type === 'details' || node.type === 'summary').length, 0);
    }
    assert.ok(requests.some(request => request.kind === 'map'));
    assert.ok(requests.some(request => request.kind === 'research'));
    assert.equal(JSON.stringify(state), before);
  }
});

check('camp visible sources use authoritative exploration rows and honestly show missing paths, locks and risks', () => {
  const state = fresh(), allRegions = engine.regionRows(state).map(row => ({ ...row, revealed: true }));
  const tree = expand(Camp(campProps(state, { exploration: { rows: [] }, regions: allRegions, onOpenRequirementHelp() {} })));
  assert.equal(elements(tree, node => node.type === 'button' && textOf(node) === '지도에서 확인').length, 0);
  assert.ok(textOf(tree).includes('현재 발견한 행동 지역에서 확인된 채집·사냥 경로가 없습니다'));
  const full = expand(Camp(campProps(state, { exploration: { rows: allRegions }, onOpenRequirementHelp() {} })));
  const text = textOf(full);
  assert.ok(text.includes('지도 제작 전')); assert.ok(text.includes('보장하지 않습니다')); assert.ok(text.includes('위험'));
  const withUnsupported = expand(Camp(campProps(state, { campActions: [{ id: 'unsupported', label: '경로 없는 재료', enabled: false,
    materialRows: [{ id: 'unknown-resource', name: '알 수 없는 재료', current: 0, required: 1, met: false }] }],
    campFacilities: [], onOpenRequirementHelp() {} })));
  assert.ok(textOf(withUnsupported).includes('획득 경로는 이 안내에서 제공하지 않습니다'));
});

check('the actual shelf control emits its real unlocking research without running a camp action or changing game state', () => {
  const state = fresh(), before = JSON.stringify(state), requests = []; let campCalls = 0;
  const tree = expand(Camp(campProps(state, { onOpenRequirementHelp: request => requests.push(request), runCamp: () => campCalls++ })));
  const shelf = elements(tree, node => node.type === 'div' && node.props.className === 'primitive-camp-action-entry')
    .find(node => textOf(node).includes('서가'));
  const button = elements(shelf, node => node.type === 'button' && textOf(node) === '선행 연구 보기')[0];
  assert.ok(button); button.props.onClick();
  const expected = engine.TECHNOLOGY_TREE.find(tech => tech.unlocks?.camp?.includes('library_shelf'));
  assert.deepEqual(requests, [{ kind: 'research', technologyId: expected.id }]);
  assert.equal(campCalls, 0); assert.equal(JSON.stringify(state), before);
});

check('requirement styles parse and retain visible keyboard focus plus narrow-layout wrapping', () => {
  const css = postcss.parse(readFileSync(new URL('src/styles/PrimitiveArchiveRequirementGuide.css', root), 'utf8'));
  const selectors = [], declarations = []; css.walkRules(rule => selectors.push(rule.selector)); css.walkDecls(decl => declarations.push([decl.prop, decl.value]));
  assert.ok(selectors.some(selector => selector.includes('focus-visible')));
  assert.ok(declarations.some(([prop, value]) => prop === 'min-width' && value === '0'));
  assert.ok(declarations.some(([prop, value]) => prop === 'overflow-wrap' && value === 'anywhere'));
});

check('actual page help handler opens only currently offered research or resource routes without gameplay writes or RNG', () => {
  for (const changes of [{}, { ap: 0, ended: true }]) {
    const state = Object.assign(fresh(), changes), before = JSON.stringify(state), stateRef = { current: state };
    const campActions = engine.campActionRows(state), campFacilities = engine.campFacilityRows(state), regions = engine.regionRows(state);
    let request = null, tab = 'camp', writes = 0;
    const handler = pageHandler('openRequirementHelp', { ...engine, state, stateRef, campActions, campFacilities, regions, campRequirementGuide,
      productionRequirementGuide, tribe: engine.tribeSummary(state), actorId: state.party[0].id,
      actorSelectionRef: { current: state.party[0].id },
      setRequirementHelpRequest: value => { request = value; writes++; }, setActiveTabId: value => { tab = value; },
      applyAction: () => { throw new Error('Help called a gameplay action'); }, setState: () => { throw new Error('Help replaced state'); } });
    const shelf = campRequirementGuide({ action: campFacilities.find(row => row.id === 'library_shelf'), regions });
    const technologyId = shelf.research[0].technologyId;
    const random = Math.random; let draws = 0;
    Math.random = () => { draws++; throw new Error('Help consumed RNG'); };
    try {
      handler({ kind: 'research', technologyId });
      assert.equal(tab, 'growth'); assert.deepEqual(request, { kind: 'research', runId: state.runId, technologyId });
      const material = [...campActions, ...campFacilities].flatMap(action => campRequirementGuide({ action, regions }).materials).find(row => row.sources.length);
      const source = material.sources[0];
      handler({ kind: 'map', resourceId: material.resourceId, regionId: source.regionId });
      assert.equal(tab, 'map'); assert.deepEqual(request, { kind: 'map', runId: state.runId, resourceId: material.resourceId, regionId: source.regionId, resourceName: material.name });
      const acceptedWrites = writes;
      for (const invalid of [null, {}, { kind: 'research', technologyId: 'missing' },
        { kind: 'map', resourceId: material.resourceId, regionId: 'hidden-or-missing' },
        { kind: 'map', resourceId: 'unknown-resource', regionId: source.regionId }]) handler(invalid);
      assert.equal(writes, acceptedWrites);
      stateRef.current = { ...state, runId: 'restored-other-run' };
      handler({ kind: 'research', technologyId }); assert.equal(writes, acceptedWrites);
      stateRef.current = { ...state, inventory: { ...state.inventory, wood: 999 } };
      handler({ kind: 'research', technologyId }); assert.equal(writes, acceptedWrites);
    } finally { Math.random = random; }
    assert.equal(draws, 0); assert.equal(JSON.stringify(state), before);
  }
});

check('normal tab navigation and restored-run handler clear help and restored requests are filtered by the actual JSX', () => {
  let request = { kind: 'research' }, tab;
  pageHandler('selectArchiveTab', { setRequirementHelpRequest: value => { request = value; }, setActiveTabId: value => { tab = value; } })('actions');
  assert.equal(request, null); assert.equal(tab, 'actions');
  const state = fresh(), setters = {};
  for (const name of ['setInitialShopRunId', 'setNewRunDifficulty', 'setActorId', 'setZoneId', 'setRecipeId', 'setSelectedRecruitId', 'setActionResult', 'setActionFeedback', 'setActiveTabId']) setters[name] = () => {};
  request = { kind: 'map', runId: state.runId };
  const session = { owner: 'restored-owner' }, autoDayGoalRef = {
    current: { id: 'exploration', epoch: 7, runId: state.runId, session: { owner: 'old-owner' } },
  };
  let goalId = 'exploration', goalEpoch = 7, report = { goalId: 'exploration', runId: state.runId };
  const resetAutoDayGoal = pageHandler('resetAutoDayGoal', {
    autoDayGoalRef, captureAuthSession: () => session,
    setAutoDayGoalId: value => { goalId = value; }, setAutoDayReport: value => { report = value; },
    setAutoDayGoalEpoch: value => { goalEpoch = value; },
  });
  pageHandler('handleRestoredRun', { ...setters, resetAutoDayGoal,
    setRequirementHelpRequest: value => { request = value; }, primitiveRestoredResultText: () => 'restored' })({ ...state, runId: 'restored-other-run' }, { source: 'slot' });
  assert.equal(request, null);
  assert.equal(goalId, 'default'); assert.equal(report, null);
  assert.equal(goalEpoch, 8);
  assert.deepEqual(autoDayGoalRef.current, { id: 'default', epoch: 8, runId: 'restored-other-run', session });
  const source = currentPage();
  const expressions = {};
  const visit = node => {
    if (ts.isJsxAttribute(node) && ['researchHelpRequest', 'mapHelpRequest', 'onOpenRequirementHelp'].includes(node.name.getText(source))) expressions[node.name.getText(source)] = node.initializer.expression.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.equal(expressions.onOpenRequirementHelp, 'openRequirementHelp');
  for (const kind of ['research', 'map']) {
    const evaluate = new Function('requirementHelpRequest', 'state', `return (${expressions[kind + 'HelpRequest']});`);
    assert.equal(evaluate({ kind, runId: 'other-run' }, state), null);
    assert.equal(evaluate({ kind: kind === 'map' ? 'research' : 'map', runId: state.runId }, state), null);
    const valid = { kind, runId: state.runId }; assert.equal(evaluate(valid, state), valid);
  }
  const feature = ts.createSourceFile('PrimitiveArchiveFeatureTabs.js', readFileSync(new URL('PrimitiveArchiveFeatureTabs.js', componentRoot), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
  let mapRequestExpression, growthKey;
  const inspectFeature = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(feature) === 'PrimitiveArchiveWorldMap') {
      mapRequestExpression = node.attributes.properties.find(attribute => attribute.name?.getText(feature) === 'mapHelpRequest')?.initializer.expression.getText(feature);
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(feature) === 'PrimitiveArchiveGrowthTab') {
      growthKey = node.attributes.properties.find(attribute => attribute.name?.getText(feature) === 'key')?.initializer.expression.getText(feature);
    }
    ts.forEachChild(node, inspectFeature);
  };
  inspectFeature(feature); assert.ok(mapRequestExpression); assert.equal(growthKey, 'state.runId');
  const filterMap = new Function('mapHelpRequest', 'state', `return (${mapRequestExpression});`);
  assert.equal(filterMap({ runId: 'old-run' }, state), null);
  const validMap = { runId: state.runId }; assert.equal(filterMap(validMap, state), validMap);
});

check('actual goal scope effect resets a replacement run or owner session while preserving the current selection', () => {
  const source = currentPage(), effects = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect'
      && node.arguments[0]?.getText(source).includes('resetAutoDayGoal(state.runId)')) effects.push(node.arguments[0].getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source); assert.equal(effects.length, 1);
  const state = fresh(), session = { revision: 1 };
  const autoDayGoalRef = { current: { id: 'development', epoch: 3, runId: state.runId, session } };
  let goalId = 'development', goalEpoch = 3, report = { runId: state.runId };
  const resetAutoDayGoal = pageHandler('resetAutoDayGoal', { autoDayGoalRef, captureAuthSession: () => session,
    setAutoDayGoalId: value => { goalId = value; }, setAutoDayReport: value => { report = value; },
    setAutoDayGoalEpoch: value => { goalEpoch = value; } });
  const effect = new Function('autoDayGoalRef', 'state', 'isCurrentAuthSession', 'resetAutoDayGoal', `return (${effects[0]});`)(
    autoDayGoalRef, state, value => value === session, resetAutoDayGoal);
  effect(); assert.equal(goalId, 'development'); assert.equal(autoDayGoalRef.current.epoch, 3); assert.ok(report);
  state.runId = 'replacement-run'; effect();
  assert.equal(goalId, 'default'); assert.equal(report, null);
  assert.deepEqual(autoDayGoalRef.current, { id: 'default', epoch: 4, runId: state.runId, session });
  assert.equal(goalEpoch, 4);
  autoDayGoalRef.current = { ...autoDayGoalRef.current, id: 'exploration', session: { revision: 0 } };
  report = { runId: state.runId }; effect();
  assert.equal(goalId, 'default'); assert.equal(report, null);
  assert.deepEqual(autoDayGoalRef.current, { id: 'default', epoch: 5, runId: state.runId, session });
  assert.equal(goalEpoch, 5);
});

check('locked Growth opens the real preview on the requested shelf research without selecting or researching it', () => {
  const state = fresh(), before = JSON.stringify(state), technology = engine.TECHNOLOGY_TREE.find(tech => tech.unlocks?.camp?.includes('library_shelf'));
  const props = growthProps(state, { researchHelpRequest: { runId: state.runId, technologyId: technology.id },
    selectResearchTarget: () => { throw new Error('Opening locked help selected research'); }, runResearch: () => { throw new Error('Opening locked help researched'); } });
  const growth = createHandlerHarness(Growth, props); const tree = growth.render();
  const previewElement = elements(tree, node => node.type === Preview)[0]; assert.ok(previewElement);
  assert.equal(previewElement.props.initialFocusId, technology.id);
  const preview = createHandlerHarness(Preview, previewElement.props); let previewTree = preview.render();
  assert.ok(textOf(elements(previewTree, node => node.type === 'aside')[0]).includes(technology.name));
  const heading = elements(previewTree, node => node.type === 'h3' && node.props.ref)[0];
  const disclosure = { open: false }, calls = [];
  heading.props.ref.current = { closest: selector => { assert.equal(selector, 'details'); return disclosure; }, focus: options => calls.push(['focus', options]), scrollIntoView: options => calls.push(['scroll', options]) };
  // Attach a synthetic DOM before re-running that same real mount effect.
  for (const effect of preview.effects) effect();
  assert.equal(disclosure.open, true); assert.deepEqual(calls.map(row => row[0]), ['focus', 'scroll']);
  const other = previewElement.props.researchMap.nodes.find(node => node.id !== technology.id);
  elements(previewTree, node => node.props?.['data-tech-id'] === other.id)[0].props.onClick();
  previewTree = preview.flush(); assert.ok(textOf(elements(previewTree, node => node.type === 'aside')[0]).includes(other.name));
  assert.equal(JSON.stringify(state), before);
});

check('unlocked Growth external focus leaves locked and available targets unchanged, while an intentional existing choice still updates its inspector', () => {
  for (const available of [false, true]) {
    const state = unlockGrowth(fresh()); const technology = engine.TECHNOLOGY_TREE.find(tech => tech.unlocks?.camp?.includes('library_shelf'));
    if (available) {
      state.research.completed = Object.fromEntries(engine.TECHNOLOGY_TREE.map(tech => [tech.id, ![technology.id, state.research.selectedTechId].includes(tech.id)]));
      state.civics.completed = Object.fromEntries(engine.CIVIC_TREE.map(tech => [tech.id, true]));
    }
    state.ap = 0;
    const before = JSON.stringify(state); let selections = 0;
    const props = growthProps(state, { researchHelpRequest: { runId: state.runId, technologyId: technology.id },
      selectResearchTarget: id => {
        selections++; const next = engine.selectTechAction(props.state, id);
        Object.assign(props, growthProps(next), { selectResearchTarget: props.selectResearchTarget, researchHelpRequest: props.researchHelpRequest });
      } });
    const target = props.techs.find(row => row.id === technology.id); assert.equal(target.available, available);
    const harness = createHandlerHarness(Growth, props); let tree = harness.render();
    assert.ok(textOf(elements(tree, node => node.type === 'aside')[0]).includes(technology.name));
    assert.equal(selections, 0); assert.equal(JSON.stringify(state), before);
    if (available) {
      elements(tree, node => node.props?.['data-tech-id'] === technology.id)[0].props.onClick();
      tree = harness.flush(); assert.equal(selections, 1); assert.equal(props.state.research.selectedTechId, technology.id);
      const other = props.researchMap.nodes.find(node => node.id !== technology.id);
      elements(tree, node => node.props?.['data-tech-id'] === other.id)[0].props.onClick();
      tree = harness.flush(); assert.ok(textOf(elements(tree, node => node.type === 'aside')[0]).includes(other.name));
    }
  }
  const state = unlockGrowth(fresh()), props = growthProps(state, { researchHelpRequest: { runId: 'old-run', technologyId: 'LIBRARY_SHELVES' } });
  const harness = createHandlerHarness(Growth, props); const tree = harness.render();
  assert.ok(elements(tree, node => node.props?.['data-tech-id'] === state.research.selectedTechId)[0].props['aria-pressed']);
});

check('real map help highlights only the discovered matching source and does not change original region selection or invoke selection', () => {
  for (const unlocked of [false, true]) {
    const state = fresh(); if (unlocked) state.research.completed.CARTOGRAPHY = true;
    const regions = engine.regionRows(state), exploration = engine.explorationSummary(state), before = JSON.stringify(state);
    const source = regions.find(row => row.revealed && !row.safe && row.zone.gather.some(gain => gain[0] === 'wood'));
    let selections = 0;
    const props = { regions, exploration, selectedRegion: exploration.selected, selectionUnlocked: unlocked,
      mapHelpRequest: { runId: state.runId, regionId: source.id, resourceId: 'wood', resourceName: '나무' }, onSelect: () => selections++ };
    const harness = createHandlerHarness(WorldMap, props); const tree = harness.render();
    const highlighted = elements(tree, node => node.type === 'button' && String(node.props.className).includes('is-requirement-help'));
    assert.equal(highlighted.length, 1); assert.ok(textOf(highlighted[0]).includes(source.name));
    assert.equal(selections, 0); assert.equal(JSON.stringify(state), before);
    assert.equal(elements(tree, node => node.type === 'button' && String(node.props.className).includes('is-selected')).length, regions.filter(row => row.selected).length);
    if (!unlocked) { assert.equal(highlighted[0].props.disabled, true); assert.ok(textOf(tree).includes('지도 제작 연구 전')); }
    else { assert.equal(highlighted[0].props.disabled, false); highlighted[0].props.onClick(); assert.equal(selections, 1); }
    for (const request of [ { regionId: regions.find(row => !row.revealed).id, resourceId: 'wood' }, { regionId: source.id, resourceId: 'missing-resource' } ]) {
      const invalid = createHandlerHarness(WorldMap, { ...props, mapHelpRequest: request }).render();
      assert.equal(elements(invalid, node => node.type === 'button' && String(node.props.className).includes('is-requirement-help')).length, 0);
      assert.equal(elements(invalid, node => node.type === 'h3' && node.props.ref).length, 0);
    }
  }
});

check('original actual region and research actions keep their existing locked/hidden guards and remain separate from help', () => {
  const state = unlockGrowth(fresh()), stateRef = { current: state }, regions = engine.regionRows(state), techs = engine.techRows(state);
  let zone, calls = 0;
  const bindings = { ...engine, state, stateRef, regions, techs, setZoneId: value => { zone = value; }, directionParticle: value => value,
    applyAction: (name, updater) => { calls++; stateRef.current = updater(stateRef.current); } };
  pageHandler('selectRegion', bindings)(regions.find(row => !row.revealed).id);
  assert.equal(stateRef.current.exploration.selectedRegionId, state.exploration.selectedRegionId); assert.ok(zone); assert.equal(calls, 1);
  const locked = techs.find(tech => !tech.available && !tech.completed); assert.ok(locked);
  pageHandler('selectResearchTarget', bindings)(locked.id);
  assert.equal(stateRef.current.research.selectedTechId, state.research.selectedTechId); assert.equal(calls, 2);
});

console.log(JSON.stringify({ pass: true, checks, scope: 'Actual camp/growth components and current page handler AST with a small hook model. No component stubs, browser geometry, persisted save, build or live-account claim.' }));
