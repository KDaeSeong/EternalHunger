import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';

globalThis.__primitiveArchiveFocusReact = React;
globalThis.__primitiveArchiveFocusButtons = [];

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const focus = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFocus.js');
const routeUrl = new URL('../src/app/games/primitive-archive/', import.meta.url);
const focusPanelUrl = new URL('_components/PrimitiveArchiveFocusPanel.js', routeUrl).href;
const featureTabsUrl = new URL('_components/PrimitiveArchiveFeatureTabs.js', routeUrl).href;
const actionWorkspaceUrl = new URL('_components/PrimitiveArchiveActionWorkspace.js', routeUrl).href;
const inventoryBarUrl = new URL('_components/PrimitiveArchiveInventoryBar.js', routeUrl).href;
const runTabUrl = new URL('_components/PrimitiveArchiveRunTab.js', routeUrl).href;
const campWorkspaceUrl = new URL('_components/PrimitiveArchiveCampWorkspace.js', routeUrl);
const growthTabUrl = new URL('_components/PrimitiveArchiveGrowthTab.js', routeUrl);
const researchPreviewUrl = new URL('_components/PrimitiveArchiveResearchTreePreview.js', routeUrl);
const transpiledUrls = new Set([focusPanelUrl, featureTabsUrl, actionWorkspaceUrl, inventoryBarUrl, runTabUrl]);
const asDataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const primitiveUiStub = `
  const jsx = (...args) => globalThis.__primitiveArchiveFocusReact.createElement(...args);
  export function ActionButton(props) {
    globalThis.__primitiveArchiveFocusButtons.push(props);
    return jsx('button', { type: 'button', disabled: props.disabled, 'data-action': props.action, children: props.children });
  }
  export function GameControlButton(props) {
    globalThis.__primitiveArchiveFocusButtons.push(props);
    return jsx('button', { type: 'button', disabled: props.disabled, 'data-action': props.action, children: props.children });
  }
  export function RecentActionResult(props) {
    return jsx('div', { className: 'focus-check-recent-result', children: [
      jsx('strong', { children: props.label, key: 'label' }),
      jsx('span', { children: props.text, key: 'text' }),
    ] });
  }
`;
const visualStub = `
  const jsx = (...args) => globalThis.__primitiveArchiveFocusReact.createElement(...args);
  export function PrimitiveArchivePanelTitle(props) {
    return jsx('header', { children: [jsx('h2', { children: props.title, key: 'title' }), props.children] });
  }
`;
const simpleComponentStub = (name) => `
  export default function ${name.replace(/[^a-zA-Z0-9]/g, '')}() {
    return globalThis.__primitiveArchiveFocusReact.createElement('section', { 'data-focus-check-stub': '${name}', children: '${name}' });
  }
`;
const featureTabStubs = new Map([
  ['./PrimitiveArchiveCampWorkspace', 'camp'],
  ['./PrimitiveArchiveGrowthTab', 'growth'],
  ['./PrimitiveArchiveDeveloperTab', 'developer'],
  ['./PrimitiveArchiveInventoryTab', 'inventory'],
  ['./PrimitiveArchivePartyWorkspace', 'party'],
  ['./PrimitiveArchiveReportTab', 'archive-report'],
  ['./PrimitiveArchiveTribeTab', 'tribe'],
  ['./PrimitiveArchiveWorldMap', 'map'],
]);
const runTabStubs = new Map([
  ['next/link', `export default function Link(props) { return globalThis.__primitiveArchiveFocusReact.createElement('a', props); }`],
  ['../../_components/GamePlayPrimitives', primitiveUiStub],
  ['../_lib/primitiveArchivePageRuntime', `export const FALLBACK_DIFFICULTY_TAGS = {}; export const multiplierText = (value) => String(value); export const startInventoryText = () => '기본 보급';`],
  ['./PrimitiveArchiveVisuals', visualStub],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === featureTabsUrl && featureTabStubs.has(specifier)) {
      return { url: asDataModule(simpleComponentStub(featureTabStubs.get(specifier))), shortCircuit: true };
    }
    if (context.parentURL === focusPanelUrl && specifier === '../../_components/GamePlayPrimitives') {
      return { url: asDataModule(primitiveUiStub), shortCircuit: true };
    }
    if (context.parentURL === actionWorkspaceUrl) {
      if (specifier === '../../_components/GamePlayPrimitives') return { url: asDataModule(primitiveUiStub), shortCircuit: true };
      if (specifier === './PrimitiveArchiveTurnHorizon') return { url: asDataModule(`export default function TurnHorizon() { return null; }`), shortCircuit: true };
      if (specifier === './PrimitiveArchiveVisuals') return { url: asDataModule(visualStub), shortCircuit: true };
    }
    if (context.parentURL === runTabUrl && runTabStubs.has(specifier)) {
      return { url: asDataModule(runTabStubs.get(specifier)), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!transpiledUrls.has(url)) return nextLoad(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
  },
});

const { default: PrimitiveArchiveFocusPanel } = await import(focusPanelUrl);
const { default: PrimitiveArchiveFeatureTabs } = await import(featureTabsUrl);
const { default: PrimitiveArchiveActionWorkspace } = await import(actionWorkspaceUrl);
const { default: PrimitiveArchiveInventoryBar } = await import(inventoryBarUrl);

const checks = [];
const failures = [];
function check(name, run) {
  try {
    run();
    checks.push(name);
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function inventoryVisibleText(html) {
  const section = html.match(/<section class="primitive-inventory-change"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
  return section
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function renderedVisibleText(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function inventorySection(html) {
  return html.match(/<section class="primitive-inventory-change"[^>]*>[\s\S]*?<\/section>/)?.[0] || '';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function freshState(runId, overrides = {}, rng = () => 0.5) {
  const base = engine.createNewState({ runId, now: '2026-10-22T00:00:00.000Z', rng });
  return engine.normalizeState({ ...base, ...overrides });
}

function planInputs(state) {
  return {
    state,
    nightRows: engine.nightSurvivalRows(state),
    research: engine.researchSummary(state),
    campActions: engine.campActionRows(state),
    archiveVictory: engine.archiveVictorySummary(state),
  };
}

function runPlan(inputs, { ready = true, busy = '' } = {}) {
  const before = structuredClone(inputs);
  deepFreeze(inputs);
  const originalRandom = Math.random;
  let randomDraws = 0;
  let plan;
  try {
    Math.random = () => { randomDraws += 1; return 0.5; };
    plan = focus.primitiveArchiveFocusPlan({ ...inputs, ready, busy });
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(randomDraws, 0, 'Focus planning must not draw random values.');
  assert.deepEqual(inputs, before, 'Focus planning must not mutate the frozen engine state or derived rows.');
  return plan;
}

function assertPlanShape(plan, { blocked } = {}) {
  assert.equal(typeof plan.blocked, 'boolean');
  if (blocked !== undefined) assert.equal(plan.blocked, blocked);
  for (const key of ['title', 'detail', 'actionLabel']) assert.equal(typeof plan.objective[key], 'string');
  assert.ok(plan.objective.title.trim());
  assert.ok(plan.objective.detail.trim());
  if (!plan.blocked) assert.ok(plan.objective.actionLabel.trim());
  if (plan.objective.targetTab) {
    assert.ok(['actions', 'camp', 'growth', 'party', 'map', 'archive-report', 'tribe', 'inventory', 'developer', 'run'].includes(plan.objective.targetTab));
  }
  for (const key of ['title', 'detail', 'tone']) assert.equal(typeof plan.night[key], 'string');
  assert.ok(Array.isArray(plan.night.rows));
}

function renderFocus(plan, onNavigate = () => {}) {
  globalThis.__primitiveArchiveFocusButtons = [];
  return {
    html: renderToStaticMarkup(React.createElement(PrimitiveArchiveFocusPanel, { plan, onNavigate })),
    buttons: globalThis.__primitiveArchiveFocusButtons,
  };
}

function tabProps(state, activeTabId) {
  const actor = state.party[0];
  const regions = engine.regionRows(state);
  const selectedRegion = regions.find((row) => row.id === state.exploration.selectedRegionId) || regions[0];
  const recipeId = 'twine';
  const recipeRows = engine.recipeRows(state);
  const recipe = recipeRows.find((row) => row.id === recipeId) || recipeRows[0];
  const difficulty = engine.difficultyRows()[0];
  const research = engine.researchSummary(state);
  const actorId = actor.id;
  return {
    activeTabId,
    actor,
    actorId,
    actionFeedback: { action: 'gather', label: '채집 결과', tone: 'ready' },
    actionForecasts: engine.actionForecastRows(state, actorId, selectedRegion?.id || 'whisper-woods', recipeId),
    adjustTribeJob() {},
    applyAction() {},
    archiveReport: engine.archiveCompletionReportForState(state),
    archiveVictory: engine.archiveVictorySummary(state),
    autoEquip() {},
    buyPerk() {},
    busy: '',
    campActions: engine.campActionRows(state),
    campFacilities: engine.campFacilityRows(state),
    canAct: true,
    changeEquipmentSlot() {},
    civicAdvancements: [],
    civicInspirationRows: [],
    civicMap: {},
    civicPlannerRows: [],
    civics: engine.civicsSummary(state),
    clearEquipment() {},
    completeRun() {},
    craftChance: 0.5,
    currentDifficulty: difficulty,
    currentLogCapacity: engine.logCapacity(state),
    developerTools: { enabled: false },
    showDeveloperTools: true,
    exploration: state.exploration,
    gatherChance: 0.5,
    huntChance: 0.5,
    inventoryRows: [],
    milestones: engine.civilizationMilestoneRows(state),
    newRunDifficulty: state.difficulty,
    partyCap: engine.getPartyCap(state),
    partySort: 'default',
    partyView: [],
    perks: [],
    projectEstimate: {},
    projects: [],
    recipe,
    recipeId,
    recipeRows,
    recentActionText: 'Day 1: 채집 결과 확인',
    recruitCandidates: [],
    research,
    researchMap: {},
    researchPlannerOpen: false,
    regions,
    recordRun() {},
    resetDeveloperTools() {},
    rivals: [],
    runProgressReport: { recoveryChoices: [] },
    runCamp() {},
    runCivic() {},
    runCraft() {},
    runDiplomacy() {},
    runEat() {},
    runGather() {},
    runHunt() {},
    runResearch() {},
    runRecoveryChoice() {},
    runRest() {},
    runSpecialized() {},
    runUtility() {},
    selectRegion() {},
    selectedDifficulty: difficulty,
    selectedRegion,
    setActiveTabId() {},
    setActorId() {},
    setNewRunDifficulty() {},
    setRecipeId() {},
    specializedActions: [],
    state,
    startNewRun() {},
    token: '',
    tribe: engine.tribeSummary(state),
    utilityActions: [],
    zone: selectedRegion || { id: 'whisper-woods', name: '속삭임 숲', note: '안전한 숲' },
    zoneId: selectedRegion?.id || 'whisper-woods',
    zoneSelectionUnlocked: false,
  };
}

function renderFeatureTabs(state, activeTabId) {
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveFeatureTabs, tabProps(state, activeTabId)));
  return { html, buttons: globalThis.__primitiveArchiveFocusButtons };
}

check('fresh engine state directs the initial locked-research gate to the real available camp action', () => {
  const state = freshState('focus-initial-gates');
  const inputs = planInputs(state);
  assert.equal(inputs.research.unlocked, false);
  const missingGate = inputs.research.gateRows.find((row) => !row.done);
  assert.ok(missingGate, 'A fresh state must expose a real incomplete research-system gate.');
  const campAction = inputs.campActions.find((row) => row.levelKey === missingGate.key);
  assert.ok(campAction, 'The first missing gate must map to a real camp action row.');
  const plan = runPlan(inputs);
  assertPlanShape(plan, { blocked: false });
  assert.equal(plan.objective.targetTab, campAction.enabled ? 'camp' : 'actions');
  assert.match(plan.objective.title, new RegExp(missingGate.label));
  assert.ok(plan.objective.detail.includes(campAction.materialText));
  assert.ok(plan.night.rows.every((row) => state.party.some((member) => member.id === row.id && member.hp > 0)));
});

check('real camp actions unlock research gates and focus advances to the next available growth target', () => {
  let state = freshState('focus-research-unlocks', {
    ap: 4,
    inventory: { ...freshState('focus-research-inventory').inventory, wood: 9, stone: 6, fiber: 4, hide: 2 },
  });
  const actorId = state.party[0].id;
  for (const action of ['fire', 'shelter', 'workbench']) {
    state = engine.runCampAction(state, actorId, action, { rng: () => 0.5 });
    assert.equal(state.camp[`${action}Level`], 1, `${action} must be completed by the actual engine action.`);
  }
  const inputs = planInputs(state);
  assert.equal(inputs.research.unlocked, true, 'Actual fire, shelter, and workbench actions must open the research system.');
  assert.ok(inputs.research.gateRows.every((row) => row.done));
  const plan = runPlan(inputs);
  assertPlanShape(plan, { blocked: false });
  assert.equal(plan.objective.targetTab, 'growth');
  assert.ok(plan.objective.title.includes(inputs.research.selected.name) || /발전/.test(plan.objective.title));
});

check('engine night forecast preserves individual damage causes and renders the at-risk survivor prominently', () => {
  const base = freshState('focus-night-risk');
  const riskyMember = { ...base.party[0], name: '야간위험 대원', hp: 70, hunger: 85, bodyTemp: 34 };
  const state = engine.normalizeState({
    ...base,
    weather: { ...base.weather, cold: 10 },
    party: [riskyMember, ...base.party.slice(1)],
    camp: { ...base.camp, fireLevel: 0, shelterLevel: 0 },
  });
  const inputs = planInputs(state);
  const riskyRow = inputs.nightRows.find((row) => row.id === riskyMember.id);
  assert.ok(riskyRow && riskyRow.damage > 0 && riskyRow.hp < riskyRow.currentHp, 'Fixture must produce actual projected night damage.');
  assert.ok(riskyRow.coldDamage > 0 || riskyRow.hungerDamage > 0 || riskyRow.hypothermiaDamage > 0);
  const plan = runPlan(inputs);
  assertPlanShape(plan, { blocked: false });
  assert.ok(plan.night.rows.some((row) => row.id === riskyRow.id && row.name === riskyMember.name));
  assert.match(plan.objective.title, /야간위험 대원/);
  const rendered = renderFocus(plan);
  assert.match(rendered.html, /야간위험 대원/);
  assert.match(rendered.html, new RegExp(`HP ${riskyRow.currentHp} → ${riskyRow.hp}`));
  for (const [cause, damage] of [['추위', riskyRow.coldDamage], ['허기', riskyRow.hungerDamage], ['저체온', riskyRow.hypothermiaDamage]]) {
    if (damage > 0) assert.match(rendered.html, new RegExp(`${cause} ${damage}`));
  }
});

check('loading and busy plans block navigation, while ended runs remain navigable to run management', () => {
  const state = freshState('focus-blocked-and-ended');
  const inputs = planInputs(state);
  const loading = runPlan(inputs, { ready: false });
  assertPlanShape(loading, { blocked: true });
  assert.equal(loading.objective.targetTab, '');
  const busy = runPlan(inputs, { busy: 'record' });
  assertPlanShape(busy, { blocked: true });
  const blockedHtml = renderFocus(loading).html;
  assert.doesNotMatch(blockedHtml, /<button/, 'A loading focus plan must not expose an actionable navigation button.');

  const endedState = engine.normalizeState({ ...state, ended: true, victory: false });
  const ended = runPlan(planInputs(endedState));
  assertPlanShape(ended, { blocked: false });
  assert.equal(ended.objective.targetTab, 'run');
  assert.deepEqual(ended.night.rows, []);
  assert.match(renderFocus(ended).html, /경기 관리 열기/);
  assert.doesNotMatch(renderFocus(ended).html, /disabled/);
});

check('actual feature navigation exposes three primary and seven collapsed secondary buttons with one linked current region for every screen', () => {
  const state = freshState('focus-tab-navigation');
  const tabIds = ['actions', 'map', 'party', 'camp', 'archive-report', 'growth', 'tribe', 'inventory', 'developer', 'run'];
  const expectedLabels = ['행동', '지도', '파티', '캠프', '기록서', '발전', '부족', '장비', '개발자', '런 관리'];
  for (const activeTabId of tabIds) {
    const rendered = renderFeatureTabs(state, activeTabId);
    const { html } = rendered;
    const navHtml = html.match(/<nav aria-label="문명 아카이브 화면 선택">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(navHtml, 'The actual feature navigation must render.');
    const buttonTags = [...navHtml.matchAll(/<button\b[^>]*>/g)].map(([tag]) => tag);
    const expectedIndex = tabIds.indexOf(activeTabId);
    const expectedId = `primitive-archive-tab-${activeTabId}`;
    const primaryGroup = navHtml.match(/<div[^>]*role="group" aria-label="주요 화면"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    const secondaryGroup = navHtml.match(/<div[^>]*role="group" aria-label="다른 화면"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    assert.ok(primaryGroup && secondaryGroup, 'Both primary and secondary navigation groups must remain available.');
    assert.equal((primaryGroup.match(/<button\b/g) || []).length, 3, 'Three primary navigation buttons must remain directly available.');
    assert.equal((secondaryGroup.match(/<button\b/g) || []).length, 7, 'All seven secondary screens must remain available inside the disclosure.');
    assert.deepEqual([...primaryGroup.matchAll(/<span>([^<]+)<\/span>/g)].map(([, label]) => label), ['행동', '캠프', '발전']);
    const currentButtons = buttonTags.filter((tag) => /\baria-current="page"/.test(tag));
    assert.equal(currentButtons.length, 1, `${activeTabId} must have exactly one current navigation button.`);
    assert.match(currentButtons[0], new RegExp(`\\bid="${expectedId}"`));
    assert.equal(buttonTags.length, 10, 'All three primary and seven secondary navigation buttons must remain rendered.');
    assert.ok(buttonTags.every((tag) => /\baria-controls="primitive-archive-feature-panel"/.test(tag)), 'Every navigation button must retain its controlled-panel link.');
    assert.ok(buttonTags.every((tag) => /\bid="primitive-archive-tab-[^"]+"/.test(tag)), 'Every navigation button must retain a stable id.');
    assert.equal((navHtml.match(/role="group"/g) || []).length, 2, 'Primary and secondary native button groups must be exposed as groups.');
    assert.doesNotMatch(navHtml, /role="tablist"|role="tab"|aria-selected=/, 'Native navigation buttons must not retain tab-widget semantics.');

    const regionTags = [...html.matchAll(/<div\b[^>]*role="region"[^>]*>/g)].map(([tag]) => tag);
    assert.equal(regionTags.length, 1, 'The actual feature body must expose one named region.');
    assert.match(regionTags[0], /\bid="primitive-archive-feature-panel"/);
    assert.match(regionTags[0], new RegExp(`\\baria-labelledby="${expectedId}"`));
    assert.match(html, new RegExp(`<span>${expectedLabels[expectedIndex]}</span>`));

    const detailsTag = html.match(/<details class="primitive-secondary-navigation"[^>]*>/)?.[0];
    assert.ok(detailsTag, 'Secondary screens must remain inside a native disclosure.');
    assert.doesNotMatch(detailsTag, /\sopen(?:=|\s|>)/, 'Secondary navigation must start collapsed.');
    if (activeTabId === 'actions') {
      assert.match(html, /primitive-basic-action-grid/, 'The actual action workspace must remain reachable in the primary group.');
      assert.doesNotMatch(html, /data-focus-check-stub=/, 'The actions view is the actual component, not a child stub.');
    } else if (activeTabId === 'run') {
      assert.doesNotMatch(html, /data-focus-check-stub=/, 'Run management is rendered from its actual child component.');
    } else {
      assert.match(html, new RegExp(`data-focus-check-stub="${activeTabId}"`), `${activeTabId} body uses the documented child stub while actual FeatureTabs navigation is rendered.`);
    }
  }
});

check('the developer screen is only offered when the page allows developer tools', () => {
  const state = freshState('focus-developer-hidden');
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveFeatureTabs, { ...tabProps(state, 'developer'), showDeveloperTools: false }));
  const navHtml = html.match(/<nav aria-label="문명 아카이브 화면 선택">([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.doesNotMatch(navHtml, /primitive-archive-tab-developer/, 'Players without access must not see the developer screen.');
  assert.equal((navHtml.match(/<button\b/g) || []).length, 9, 'The other nine screens remain available.');
  assert.doesNotMatch(html, /data-focus-check-stub="developer"/, 'A saved developer tab id must fall back to a regular screen.');
  assert.match(html, /aria-labelledby="primitive-archive-tab-actions"/, 'The fallback screen is the action workspace.');
});

check('actual action-workspace JSX puts the latest result before technology lists and keeps both lists closed by default', () => {
  const state = freshState('focus-action-result-order');
  const props = tabProps(state, 'actions');
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  const resultPosition = html.indexOf('primitive-action-result');
  const firstTechnologyPosition = html.indexOf('기술 해금 생업');
  assert.ok(resultPosition >= 0 && firstTechnologyPosition > resultPosition, 'Rendered action result must precede the technology list.');
  assert.match(html, /채집 결과/);
  const technologyLists = [...html.matchAll(/<details class="primitive-specialized-actions[^\"]*"[^>]*>/g)].map((match) => match[0]);
  assert.equal(technologyLists.length, 2, 'Both technology list sections must remain available.');
  for (const openingTag of technologyLists) assert.doesNotMatch(openingTag, /\sopen(?:=|\s|>)/, 'Technology lists must start collapsed.');
});

check('persistent inventory bar shows core zero counts and reacts to real gathered inventory props', () => {
  const state = freshState('focus-live-inventory-bar');
  const toRows = (inventory) => Object.entries(inventory).filter(([, quantity]) => Number(quantity || 0) > 0).sort(([a], [b]) => engine.itemName(a).localeCompare(engine.itemName(b), 'ko-KR'));
  const render = (inventory) => renderToStaticMarkup(React.createElement(PrimitiveArchiveInventoryBar, { inventory, inventoryRows: toRows(inventory) }));
  const initialHtml = render(state.inventory);
  const initialText = renderedVisibleText(initialHtml);
  for (const [id, quantity] of [['wood', 2], ['stone', 2], ['fiber', 2], ['hide', 0], ['berry', 2], ['meat', 0], ['herb', 0], ['clay', 0]]) {
    assert.ok(initialText.includes(`${engine.itemName(id)} ${quantity}`), `Core resource ${id} must show its current count, including zero.`);
  }

  const gathered = engine.runGatherAction(state, state.party[0].id, state.exploration.selectedRegionId || 'whisper-woods', { rng: () => 0 });
  const gatheredHtml = render(gathered.inventory);
  const gatheredText = renderedVisibleText(gatheredHtml);
  for (const id of ['wood', 'stone', 'fiber', 'hide', 'berry', 'meat', 'herb', 'clay']) {
    assert.ok(gatheredText.includes(`${engine.itemName(id)} ${Number(gathered.inventory[id] || 0)}`), `Rerender after gathering must reflect live ${id} ownership.`);
  }
  assert.notDeepEqual(gathered.inventory, state.inventory, 'The deterministic gather must change at least one current inventory count.');
});

check('persistent inventory bar details list all positive food, equipment, and custom inventory', () => {
  const inventory = { wood: 2, cooked_meat: 3, metal_tools: 1, custom_relic: 4 };
  const inventoryRows = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveInventoryBar, { inventory, inventoryRows }));
  const summary = html.match(/<details class="primitive-inventory-bar__all">([\s\S]*?)<\/details>/)?.[1] || '';
  const summaryText = renderedVisibleText(summary);
  assert.ok(summaryText.includes('전체 보유품 4종'), 'The native disclosure count must match all positive inventory rows.');
  for (const label of ['구운 고기', '금속 공구', 'custom_relic']) assert.ok(summaryText.includes(label), `The full inventory disclosure must include ${label}.`);
  assert.ok(summaryText.includes('3') && summaryText.includes('1') && summaryText.includes('4'), 'The disclosure must include each current quantity.');
  assert.match(summary, /<summary>전체 보유품 4종<\/summary>/, 'Full inventory remains a native collapsed disclosure without tab navigation.');
});

check('action result shows exact inventory deltas and omits the strip without a comparison', () => {
  const state = freshState('focus-inventory-change');
  const props = tabProps(state, 'actions');
  props.actionFeedback = { ...props.actionFeedback, inventoryChange: { rows: [{ id: 'wood', before: 2, after: 4, delta: 2 }], dayChanged: false } };
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  const section = inventorySection(html);
  const visibleText = inventoryVisibleText(html);
  assert.ok(section.includes('aria-label="보유 자원 변화"'), 'Inventory summary must have its accessible label.');
  assert.ok(visibleText.includes('보유 자원 변화'), 'Inventory summary heading must be visible.');
  assert.ok(visibleText.includes('나무 +2 (2 → 4)'), 'The visible summary must show the exact item, signed delta, and before/after quantities.');

  props.actionFeedback = { ...props.actionFeedback, inventoryChange: null };
  globalThis.__primitiveArchiveFocusButtons = [];
  const withoutComparison = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  assert.doesNotMatch(withoutComparison, /primitive-inventory-change/);
});

check('action result clearly renders zero changes and day-rollover settlement context', () => {
  const state = freshState('focus-inventory-no-change');
  const props = tabProps(state, 'actions');
  props.actionFeedback = { ...props.actionFeedback, inventoryChange: { rows: [], dayChanged: false } };
  globalThis.__primitiveArchiveFocusButtons = [];
  const noChange = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  assert.ok(inventoryVisibleText(noChange).includes('변동 없음'), 'An empty comparison must be presented as no change.');

  props.actionFeedback = { ...props.actionFeedback, inventoryChange: { rows: [{ id: 'wood', before: 4, after: 3, delta: -1 }], dayChanged: true, beforeDay: 2, afterDay: 3 } };
  globalThis.__primitiveArchiveFocusButtons = [];
  const rolledOver = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  const rolloverText = inventoryVisibleText(rolledOver);
  assert.ok(rolloverText.includes('나무 -1 (4 → 3)'), 'A negative net change must retain its sign and quantities.');
  assert.ok(rolloverText.includes('하루 경과·정산 포함'), 'Day rollover must disclose that settlement is included.');
});

check('action result keeps the first five inventory rows visible and discloses the remainder natively', () => {
  const state = freshState('focus-inventory-many');
  const props = tabProps(state, 'actions');
  const rows = ['wood', 'stone', 'fiber', 'berry', 'hide', 'meat', 'leather_strip'].map((id, index) => ({ id, before: index, after: index + 1, delta: 1 }));
  props.actionFeedback = { ...props.actionFeedback, inventoryChange: { rows, dayChanged: false } };
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  const section = inventorySection(html);
  const firstList = section.match(/<ul class="primitive-inventory-change__list">([\s\S]*?)<\/ul>/)?.[1] || '';
  const disclosure = section.match(/<details class="primitive-inventory-change__more">([\s\S]*?)<\/details>/)?.[1] || '';
  const sectionText = inventoryVisibleText(html);
  const firstListText = firstList.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const disclosureText = disclosure.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.ok(sectionText.includes('나머지 2개 변화 보기'), 'The native disclosure must announce the number of hidden rows.');
  assert.ok(firstListText.includes('나무 +1 (0 → 1)'), 'The first row must be immediately visible.');
  assert.ok(firstListText.includes('가죽 +1 (4 → 5)'), 'The fifth row must remain immediately visible.');
  assert.ok(!firstListText.includes('고기 +1'), 'The sixth row must not clutter the always-visible summary.');
  assert.ok(disclosureText.includes('고기 +1 (5 → 6)') && disclosureText.includes('가죽끈 +1 (6 → 7)'), 'The disclosure must contain every remaining row.');
});

check('fresh gather forecast labels the unchanged average in both actual UI surfaces', () => {
  const state = freshState('focus-harvest-average-label');
  const actorId = state.party[0].id;
  const regionId = state.exploration.selectedRegionId || 'whisper-woods';
  const stateBeforeForecast = structuredClone(state);
  const forecastRows = engine.actionForecastRows(state, actorId, regionId, 'twine');
  const gatherForecast = forecastRows.find((row) => row.id === 'gather');
  assert.ok(gatherForecast, 'The real fresh-state action forecast must include gathering.');
  assert.match(gatherForecast.outcome, /^1회 평균: /, 'Expected harvest must be labeled as a per-action average.');
  assert.match(gatherForecast.outcome, /나무 0\.8개/, 'The current fresh-state expected wood amount and one-decimal rounding must remain unchanged.');
  assert.deepEqual(state, stateBeforeForecast, 'Forecasting must not mutate its source state.');

  const props = { ...tabProps(state, 'actions'), actionForecasts: forecastRows };
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  assert.ok(html.split(gatherForecast.outcome).length - 1 >= 2, 'Both the basic gather hint and expanded forecast card must render the same labeled estimate.');
  assert.match(html, /‘1회 평균’은 실패와 자원 출현 확률까지 반영한 예상 수확입니다\./, 'The expanded forecast must explain that average yields include failure and resource chance.');
  assert.match(html, /실제 수확은 정수 개수이며, 매번 모든 자원을 받는다는 뜻은 아닙니다\./, 'The expanded forecast must distinguish the estimate from actual integer payouts.');
  assert.deepEqual(state, stateBeforeForecast, 'Rendering the forecast must not mutate its source state.');

  const gathered = engine.runGatherAction(state, actorId, regionId, { rng: () => 0 });
  assert.equal(gathered.counters.gather, Number(state.counters.gather || 0) + 1);
  assert.ok(Object.values(gathered.inventory).every(Number.isInteger), 'A real successful gather must still pay whole items.');
  const resultLog = gathered.log.find((line) => line.includes('채집 성공.'));
  assert.ok(resultLog, 'The actual paid action must retain its successful gather explanation.');
  assert.doesNotMatch(resultLog, /1회 평균:/, 'Actual payout logs must not be relabeled as forecasts.');

  const engineSource = readFileSync(new URL('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js', import.meta.url), 'utf8');
  const expectedSource = engineSource.slice(engineSource.indexOf('function expectedZoneGains('), engineSource.indexOf('const SPECIALIZED_ACTION_DEFS', engineSource.indexOf('function expectedZoneGains(')));
  assert.match(expectedSource, /successChance \* regionWeight \* zoneEntryChance\(state, chance, context\) \* \(Number\(qty \|\| 0\) \+ bonusChance\)/, 'The existing expectation formula must retain its success, drop, and bonus probabilities.');
  const gatherStart = engineSource.indexOf('export function runGatherAction(');
  const gatherEnd = engineSource.indexOf('export function runHuntAction(', gatherStart);
  const gatherSource = engineSource.slice(gatherStart, gatherEnd);
  assert.match(gatherSource, /rollZoneGains\([\s\S]*?inventory: addItems\(next\.inventory, gains\)[\s\S]*?formatGains\(gains\)/, 'Actual payouts and logs must remain on the existing randomized integer-gain path.');
});

check('fresh foodless forecast locks personal meal and rendering does not spend AP or mutate state', () => {
  const seeded = freshState('focus-foodless-meal');
  const state = engine.normalizeState({
    ...seeded,
    inventory: Object.fromEntries(Object.keys(seeded.inventory).map((itemId) => [itemId, 0])),
  });
  const before = structuredClone(state);
  const forecastRows = engine.actionForecastRows(state, state.party[0].id, state.exploration.selectedRegionId, 'twine');
  const mealForecast = forecastRows.find((row) => row.id === 'consume');
  assert.equal(mealForecast?.locked, true, 'The real fresh-engine forecast must lock eating when no food is held.');
  assert.deepEqual(state, before, 'Forecasting must not mutate the fresh run or consume AP.');

  const props = { ...tabProps(state, 'actions'), actionForecasts: forecastRows };
  globalThis.__primitiveArchiveFocusButtons = [];
  renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  const mealButton = globalThis.__primitiveArchiveFocusButtons.find((button) => button.action === 'consume' && button.children === '개인 식사');
  assert.ok(mealButton, 'The real action workspace must render the personal meal button.');
  assert.equal(mealButton.disabled, true, 'The rendered personal meal button must match the locked engine forecast.');
  assert.deepEqual(state, before, 'Rendering a locked meal must not mutate state or spend AP.');
});

check('camp controls are placed before the run report in the real camp workspace source', () => {
  const source = readFileSync(campWorkspaceUrl, 'utf8');
  const campActionsPosition = source.indexOf('className="primitive-camp-action-grid"');
  const runReportPosition = source.indexOf('title="런 리포트"');
  assert.ok(campActionsPosition >= 0, 'Camp action controls must be present.');
  assert.ok(runReportPosition > campActionsPosition, 'Camp controls must appear before the run report.');
});

check('locked full advancement preview is collapsed without removing searchable tree access', () => {
  const growthSource = readFileSync(growthTabUrl, 'utf8');
  const previewSource = readFileSync(researchPreviewUrl, 'utf8');
  const previewDetails = growthSource.match(/<details className="primitive-growth-preview"[^>]*>([\s\S]*?)<\/details>/);
  assert.ok(previewDetails, 'The locked full tree preview must be wrapped in a native details disclosure.');
  assert.doesNotMatch(previewDetails[0], /\bopen(?:=|\s|>)/, 'The full tree must start collapsed to reduce visual clutter.');
  assert.match(previewDetails[1], /<summary>전체 \{trackLabel\} 트리 미리보기<\/summary>/, 'The collapsed disclosure must retain a clear full-tree label.');
  assert.match(previewDetails[1], /<PrimitiveArchiveResearchTreePreview[^>]*researchMap=\{advancementMap\}[^>]*track=\{activeTrack\}/, 'The complete track preview must remain accessible inside the disclosure.');
  assert.match(previewSource, /<input[\s\S]*?value=\{query\}[\s\S]*?onChange=\{\(event\) => setQuery\(event\.target\.value\)\}/, 'The preview must retain its searchable filter.');
  assert.match(previewSource, /researchMap\.nodes\.map\(\(node\) =>/, 'The preview must retain every engine-provided advancement node.');
});

const playContent = readFileSync(new URL('../src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js', import.meta.url), 'utf8');
assert.match(playContent, /const focusPlan = primitiveArchiveFocusPlan\(/, 'The live page must use the tested focus plan.');
assert.match(playContent, /<PrimitiveArchiveFocusPanel plan=\{focusPlan\} onNavigate=\{setActiveTabId\} \/>\s*<PrimitiveArchiveInventoryBar inventory=\{state\.inventory\} inventoryRows=\{inventoryRows\} \/>\s*<PrimitiveArchiveFeatureTabs/s, 'The live focus panel must be followed by the persistent inventory bar before the real feature tabs.');
assert.match(playContent, /<details className="primitive-guide-details">\s*<summary>상세 생존 안내<\/summary>\s*<GameAdvisorPanel/s, 'Existing detailed survival advice must remain available below the main interface.');

console.log(JSON.stringify({ pass: failures.length === 0, checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
