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
const runtime = await import('../src/app/games/primitive-archive/_lib/primitiveArchivePageRuntime.js');
const routeUrl = new URL('../src/app/games/primitive-archive/', import.meta.url);
const focusPanelUrl = new URL('_components/PrimitiveArchiveFocusPanel.js', routeUrl).href;
const featureTabsUrl = new URL('_components/PrimitiveArchiveFeatureTabs.js', routeUrl).href;
const actionWorkspaceUrl = new URL('_components/PrimitiveArchiveActionWorkspace.js', routeUrl).href;
const inventoryBarUrl = new URL('_components/PrimitiveArchiveInventoryBar.js', routeUrl).href;
const runTabUrl = new URL('_components/PrimitiveArchiveRunTab.js', routeUrl).href;
const inventoryTabUrl = new URL('_components/PrimitiveArchiveInventoryTab.js', routeUrl).href;
const partyWorkspaceUrl = new URL('_components/PrimitiveArchivePartyWorkspace.js', routeUrl).href;
const projectsPanelUrl = new URL('_components/PrimitiveArchiveProjectsPanel.js', routeUrl).href;
const workspaceTabsUrl = new URL('_components/PrimitiveArchiveWorkspaceTabs.js', routeUrl).href;
const tribeTabUrl = new URL('_components/PrimitiveArchiveTribeTab.js', routeUrl).href;
const campWorkspaceUrl = new URL('_components/PrimitiveArchiveCampWorkspace.js', routeUrl);
const growthTabUrl = new URL('_components/PrimitiveArchiveGrowthTab.js', routeUrl);
const researchPreviewUrl = new URL('_components/PrimitiveArchiveResearchTreePreview.js', routeUrl);
const transpiledUrls = new Set([focusPanelUrl, featureTabsUrl, actionWorkspaceUrl, inventoryBarUrl, runTabUrl, inventoryTabUrl, partyWorkspaceUrl, projectsPanelUrl, workspaceTabsUrl, tribeTabUrl]);
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
  export function SmallStat(props) {
    return jsx('div', { children: [jsx('span', { children: props.label, key: 'label' }), jsx('strong', { children: props.value, key: 'value' })] });
  }
`;
const visualStub = `
  const jsx = (...args) => globalThis.__primitiveArchiveFocusReact.createElement(...args);
  export function PrimitiveArchivePanelTitle(props) {
    return jsx('header', { children: [jsx('h2', { children: props.title, key: 'title' }), props.meta, props.children] });
  }
  export function PrimitiveArchiveIconRow(props) { return jsx('div', { children: props.children }); }
  export const primitiveItemAction = () => 'inventory';
`;
const inventoryHooksStub = `
  export function useState(initial) {
    const harness = globalThis.__primitiveArchiveInventoryHooks;
    const index = harness.cursor++;
    if (!(index in harness.values)) harness.values[index] = index === 0 ? harness.workspace || 'log' : typeof initial === 'function' ? initial() : initial;
    return [harness.values[index], (next) => {
      harness.values[index] = typeof next === 'function' ? next(harness.values[index]) : next;
    }];
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
  ['./PrimitiveArchiveFoundersTab', 'founders'],
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
    if ([inventoryTabUrl, partyWorkspaceUrl, projectsPanelUrl, workspaceTabsUrl, tribeTabUrl].includes(context.parentURL)) {
      if (specifier === 'react' && context.parentURL === inventoryTabUrl) return { url: asDataModule(inventoryHooksStub), shortCircuit: true };
      if (specifier === '../../_components/GamePlayPrimitives') return { url: asDataModule(primitiveUiStub), shortCircuit: true };
      if (specifier === './PrimitiveArchiveVisuals') return { url: asDataModule(visualStub), shortCircuit: true };
      if (specifier === 'next/image' || specifier === '../../_components/GameActionIcon') return { url: asDataModule('export default function Icon() { return null; }'), shortCircuit: true };
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
const { default: PrimitiveArchiveInventoryTab } = await import(inventoryTabUrl);
const { default: PrimitiveArchivePartyWorkspace } = await import(partyWorkspaceUrl);
const { default: PrimitiveArchiveProjectsPanel } = await import(projectsPanelUrl);
const { default: PrimitiveArchiveTribeTab } = await import(tribeTabUrl);

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
    recruitCandidates: engine.recruitablePartyRows(state),
    partyCap: engine.getPartyCap(state),
    supplies: engine.survivalSupplySummary(state),
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
    runSafeGather() {},
    safeGatherRows: engine.safeGatherActionRows(state, actorId),
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

check('actual feature navigation exposes three primary and eight collapsed secondary buttons with one linked current region for every screen', () => {
  const state = freshState('focus-tab-navigation');
  const tabIds = ['actions', 'map', 'party', 'camp', 'archive-report', 'growth', 'tribe', 'inventory', 'founders', 'developer', 'run'];
  const expectedLabels = ['행동', '지도', '파티', '캠프', '기록서', '발전', '부족', '장비', '창건자·전승', '개발자', '런 관리'];
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
    assert.equal((secondaryGroup.match(/<button\b/g) || []).length, 8, 'All eight secondary screens must remain available inside the disclosure.');
    assert.deepEqual([...primaryGroup.matchAll(/<span>([^<]+)<\/span>/g)].map(([, label]) => label), ['행동', '캠프', '발전']);
    const currentButtons = buttonTags.filter((tag) => /\baria-current="page"/.test(tag));
    assert.equal(currentButtons.length, 1, `${activeTabId} must have exactly one current navigation button.`);
    assert.match(currentButtons[0], new RegExp(`\\bid="${expectedId}"`));
    assert.equal(buttonTags.length, 11, 'All three primary and eight secondary navigation buttons must remain rendered.');
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
  assert.equal((navHtml.match(/<button\b/g) || []).length, 10, 'The other ten screens remain available.');
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

check('secondary navigation names party and map directly without adding persistent tabs', () => {
  const html = renderFeatureTabs(freshState('discoverable-party-map'), 'actions').html;
  const menu = html.match(/<details class="primitive-secondary-navigation">[\s\S]*?<\/details>/)?.[0] || '';
  assert.ok(menu.includes('파티·지도 등'));
  assert.ok(menu.includes('primitive-archive-tab-map') && menu.includes('primitive-archive-tab-party'));
  assert.doesNotMatch(menu.match(/^<details[^>]*>/)?.[0] || '', /\sopen(?:=|\s|>)/, 'Other screens remain in the existing collapsed menu.');
});

check('specialized livelihoods and utility controls show their real costs before activation', () => {
  const state = freshState('focus-specialized-action-costs');
  for (const row of [...engine.specializedActionRows(state, state.party[0].id), ...engine.utilityActionRows(state, state.party[0].id)]) {
    state.research.completed[row.techId] = true;
  }
  for (const region of engine.WORLD_REGIONS) state.exploration.revealed[region.id] = true;
  const before = structuredClone(state);
  const actorId = state.party[0].id;
  const specializedActions = engine.specializedActionRows(state, actorId);
  const utilityActions = engine.utilityActionRows(state, actorId);
  assert.ok(specializedActions.some((row) => row.available && row.id === 'mine'));
  for (const [kind, rows] of [['specialized', specializedActions], ['utility', utilityActions]]) {
    const calls = [];
    globalThis.__primitiveArchiveFocusButtons = [];
    renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, {
      ...tabProps(state, 'actions'), specializedActions, utilityActions,
      runSpecialized: (id) => calls.push(['specialized', id]),
      runUtility: (id) => calls.push(['utility', id]),
    }));
    for (const row of rows) {
      const button = globalThis.__primitiveArchiveFocusButtons.find((entry) => entry.action === row.icon);
      assert.ok(button, `${row.id}: actual control must exist.`);
      const visible = renderedVisibleText(renderToStaticMarkup(React.createElement('span', null, button.children)));
      assert.ok(visible.includes(row.cost), `${row.id}: cost must be visible without hovering.`);
      assert.ok(button.title.includes(row.cost), `${row.id}: tooltip must retain the same real cost.`);
      assert.equal(Boolean(button.disabled), !row.available);
      button.onClick();
      assert.deepEqual(calls.at(-1), [kind, row.id]);
    }
  }
  assert.deepEqual(state, before, 'Displaying costs must not spend resources or alter the run.');
});

check('actual workforce controls lock after an ending or during persistence while holdings stay inspectable', () => {
  const base = freshState('focus-workforce-terminal-guard');
  base.tribe.population = 4;
  base.tribe.assignments.forager = 1;
  base.tribe.autoAssignments.forager = 0;
  for (const [ended, busy] of [[false, ''], [true, ''], [false, 'save']]) {
    const state = { ...base, ended };
    const tribe = engine.tribeSummary(state);
    const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveTribeTab, { ...tabProps(state, 'tribe'), tribe, busy }));
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0]).filter((tag) => tag.includes('배치 1명'));
    assert.equal(buttons.length, tribe.jobs.length * 2);
    for (const job of tribe.jobs) {
      for (const [label, enabled] of [['감소', job.canRemove], ['증가', job.canAdd]]) {
        const tag = buttons.find((entry) => entry.includes(`aria-label="${job.name} 배치 1명 ${label}"`));
        assert.ok(tag);
        assert.equal(/\bdisabled(?:=|\s|>)/.test(tag), Boolean(ended || busy || !enabled));
      }
    }
    assert.ok(renderedVisibleText(html).includes('직접 배치 1명'), 'Job assignment counts must stay visible.');
    if (ended) assert.ok(renderedVisibleText(html).includes('종료된 런에서는 직업 배치를 변경할 수 없습니다'), 'Ended workforce controls need a read-only explanation.');
  }
});

check('persistent inventory bar shows core zero counts and reacts to real gathered inventory props', () => {
  const state = freshState('focus-live-inventory-bar');
  const toRows = (inventory) => Object.entries(inventory).filter(([, quantity]) => Number(quantity || 0) > 0).sort(([a], [b]) => engine.itemName(a).localeCompare(engine.itemName(b), 'ko-KR'));
  const render = (inventory) => renderToStaticMarkup(React.createElement(PrimitiveArchiveInventoryBar, { inventory, inventoryRows: toRows(inventory) }));
  const initialHtml = render(state.inventory);
  const initialText = renderedVisibleText(initialHtml);
  for (const [id, quantity] of [['wood', 4], ['stone', 2], ['fiber', 2], ['hide', 0], ['berry', 6], ['meat', 0], ['herb', 0], ['clay', 0]]) {
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

check('unneeded shared meals explain the missing recipient instead of claiming held food is missing', () => {
  const state = freshState('healthy-shared-meal-label');
  state.inventory = { berry: 3, herb_tonic: 1 };
  state.party = state.party.map((member) => ({ ...member, hp: 100, hunger: 0, stamina: 100, bodyTemp: 37 }));
  const props = { ...tabProps(state, 'actions'), runProgressReport: engine.getRunProgressReport(state, state.party[0].id) };
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, props));
  const button = globalThis.__primitiveArchiveFocusButtons.find((entry) => entry.children === '공동 식사 · 1 AP');
  assert.equal(button.disabled, true);
  assert.match(html, /배식할 대원이나 식량이 없습니다/);
  assert.doesNotMatch(html, /식량 필요/);
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

check('fallen-companion guidance uses real recruitment limits after every urgent survival branch', () => {
  const makeState = () => {
    const state = freshState('fallen-companion-guidance');
    state.party = state.party.map((member, index) => ({ ...member, hp: index ? 0 : 97, hunger: 12, bodyTemp: 37 }));
    state.weather = { ...state.weather, id: 'clear', cold: 0 };
    state.camp = { ...state.camp, fireLevel: 1, shelterLevel: 1, workbenchLevel: 1, fuel: 3 };
    return state;
  };
  const full = runPlan(planInputs(makeState()));
  assert.equal(full.objective.targetTab, 'growth');
  assert.ok(full.objective.title.includes('1/3'));
  assert.ok(full.objective.detail.includes('정원'));

  const available = makeState();
  available.research.completed.SETTLEMENT = true;
  assert.equal(runPlan(planInputs(available)).objective.targetTab, 'party');

  const exhausted = makeState();
  exhausted.party = engine.STUDENTS.map((student, index) => ({ ...student, hp: index ? 0 : 97, hunger: 12, stamina: 90, bodyTemp: 37 }));
  assert.equal(runPlan(planInputs(exhausted)).objective.targetTab, 'run');

  for (const [kind, update, expected] of [
    ['fatal', (state) => { state.party[0].hp = 5; state.party[0].hunger = 100; }, '밤 생존'],
    ['hunger', (state) => { state.party[0].hunger = 70; }, '허기 확인'],
    ['weak', (state) => { state.party[0].hp = 20; }, '상태부터 확인'],
    ['cold', (state) => { state.weather.cold = 12; }, '추위에 대비'],
  ]) {
    const state = makeState();
    state.research.completed.SETTLEMENT = true;
    update(state);
    assert.ok(runPlan(planInputs(state)).objective.title.includes(expected), `${kind}: urgent care must precede recruitment guidance.`);
  }
  const restoredParty = makeState();
  restoredParty.party.forEach((member) => { member.hp = 97; });
  assert.ok(!runPlan(planInputs(restoredParty)).objective.title.includes('/3명 필요'));
  assert.equal(runPlan(planInputs({ ...makeState(), ended: true })).objective.targetTab, 'run');
  assert.equal(runPlan(planInputs(makeState()), { ready: false }).blocked, true);
  assert.equal(runPlan(planInputs(makeState()), { busy: 'save' }).blocked, true);
});

check('party cards name death explicitly and preserve recorded or unknown causes without invented history', () => {
  const records = [
    undefined,
    { day: 20, source: 'night', reason: '허기·추위·저체온', hpBefore: 20, damage: 33, coldDamage: 5, hungerDamage: 10, hypothermiaDamage: 18 },
    { day: 15, source: 'action', reason: '사냥 반격', hpBefore: 3, damage: 5 },
    { day: {}, source: {}, reason: {}, damage: 'NaN', coldDamage: -1 },
  ];
  for (const record of records) {
    const state = freshState('party-death-summary');
    state.day = 102;
    const member = { ...state.party[1], hp: 0, deathRecord: record };
    state.party[1] = member;
    const badges = runtime.vitalBadges(member);
    assert.ok(badges.includes('사망') && !badges.includes('탈진'));
    const before = structuredClone(state);
    const html = renderToStaticMarkup(React.createElement(PrimitiveArchivePartyWorkspace, {
      ...tabProps(state, 'party'),
      partyView: [{ member, badges, chances: { gather: 0.5, hunt: 0.5, craft: 0.5 }, basisAction: 'gather', basisChance: 0.5 }],
    }));
    const text = renderedVisibleText(html);
    assert.ok(text.includes('사망'));
    assert.ok(!text.includes('추천 채집'), 'A dead companion must not be shown a new action recommendation.');
    assert.ok(!text.includes('NaN') && !text.includes('[object Object]'));
    if (record?.source === 'night') {
      for (const part of ['20일차', '밤 정산', '추위 5', '허기 10', '저체온 18', 'HP 피해 33']) assert.ok(text.includes(part), part);
    } else if (record?.source === 'action') {
      for (const part of ['15일차', '행동 중', '사냥 반격', 'HP 피해 5']) assert.ok(text.includes(part), part);
    } else {
      assert.ok(text.includes('사망 원인 기록 없음'));
      assert.ok(!text.includes('102일차'), 'Legacy deaths must not be dated to the current day.');
    }
    assert.deepEqual(state, before);
  }
});

check('actual party controls reject ended runs while preserving live free recruitment', () => {
  const state = freshState('recruit-control-guards');
  state.research.completed.SETTLEMENT = true;
  for (const ended of [false, true]) {
    const current = { ...state, ended };
    const candidates = engine.recruitablePartyRows(current);
    globalThis.__primitiveArchiveFocusButtons = [];
    renderToStaticMarkup(React.createElement(PrimitiveArchivePartyWorkspace, {
      ...tabProps(current, 'party'), hydrated: true, recruitCandidates: candidates, selectedRecruit: candidates[0],
    }));
    const button = globalThis.__primitiveArchiveFocusButtons.find((row) => row.action === 'recruit');
    assert.ok(button);
    assert.equal(button.disabled, ended);
  }
});

check('actual project control receives the selected living-actor gate without disabling the automatic-day gate', () => {
  const state = freshState('development-control-guards');
  Object.assign(state.research.completed, { GATHERING: true, HUNTING: true });
  state.inventory = { ...state.inventory, wood: 30, fiber: 30 };
  const project = engine.projectRows(state).find((row) => row.canWork);
  assert.ok(project);
  for (const hp of [0, 100]) {
    const actor = { ...state.party[0], hp };
    const canAct = true;
    globalThis.__primitiveArchiveFocusButtons = [];
    renderToStaticMarkup(React.createElement(PrimitiveArchiveProjectsPanel, {
      canAct: canAct && Number(actor.hp || 0) > 0,
      projects: [project], selectedProject: project, projectEstimate: engine.projectActionEstimate(state, actor.id, project.id),
    }));
    assert.equal(globalThis.__primitiveArchiveFocusButtons.find((row) => row.action === 'project').disabled, hp === 0);
  }
  const source = readFileSync(new URL('_components/PrimitiveArchivePlayContent.js', routeUrl), 'utf8');
  assert.match(source, /const actorCanAct = canAct && Number\(actor\?\.hp \|\| 0\) > 0;/);
  assert.match(source, /canAct=\{actorCanAct\}/);
  assert.match(source, /action="auto"[^\n]+disabled=\{!canAct\}/);
});

check('one surviving HP keeps the actual recovery controls enabled while terminal runs remain blocked', () => {
  const state = freshState('one-hp-recovery-controls');
  state.party = state.party.map((member, index) => ({ ...member, hp: index === 0 ? 1 : 0 }));
  for (const ended of [false, true]) {
    const current = { ...state, ended };
    const canAct = !current.ended && engine.hasLivingPartyMember(current) && current.ap > 0;
    globalThis.__primitiveArchiveFocusButtons = [];
    renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, { ...tabProps(current, 'actions'), canAct }));
    const rest = globalThis.__primitiveArchiveFocusButtons.find((button) => button.action === 'rest');
    assert.ok(rest);
    assert.equal(rest.disabled, ended);
  }
  const source = readFileSync(new URL('_components/PrimitiveArchivePlayContent.js', routeUrl), 'utf8');
  assert.match(source, /const dead = state\.ended \|\| !hasLivingPartyMember\(state\);/);
});

function renderInventoryLog(state, harness = { values: [], cursor: 0 }) {
  harness.cursor = 0;
  globalThis.__primitiveArchiveInventoryHooks = harness;
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveInventoryTab, {
    ...tabProps(state, 'inventory'), equipmentInventory: [], equipmentAdviceRows: [],
    currentEquipmentRows: engine.equipmentRows(state, state.party[0].id), busy: harness.busy || '',
  }));
  return { html, buttons: globalThis.__primitiveArchiveFocusButtons, harness };
}

check('equipment remains inspectable but its actual editing controls lock after the run ends or while busy', () => {
  const base = freshState('equipment-ui-terminal-guards');
  base.inventory.hide_coat = 1;
  for (const [ended, busy] of [[false, ''], [true, ''], [false, 'save']]) {
    const state = { ...base, ended };
    const rendered = renderInventoryLog(state, { values: [], cursor: 0, workspace: 'equipment', busy });
    const locked = Boolean(ended || busy);
    const controls = rendered.buttons.filter((button) => ['equip', 'reset'].includes(button.action));
    assert.equal(controls.length, 3);
    assert.ok(controls.every((button) => button.disabled === locked));
    const slots = [...rendered.html.matchAll(/<label class="primitive-equipment-slot">([\s\S]*?)<\/label>/g)];
    assert.ok(slots.length > 0);
    assert.ok(slots.every(([, html]) => /<select[^>]*\bdisabled/.test(html) === locked));
    assert.match(rendered.html, /가죽 상의/, 'Owned equipment must remain viewable.');
    if (ended) assert.match(rendered.html, /열람만 가능합니다/);
  }
});

check('actual log controls progressively reveal every stored entry and can return to recent entries', () => {
  for (const count of [30, 55]) {
    const state = freshState(`log-history-${count}`);
    state.log = Array.from({ length: count }, (_, index) => `history-entry-${String(index + 1).padStart(3, '0')}`);
    const before = structuredClone(state);
    let rendered = renderInventoryLog(state);
    assert.equal((rendered.html.match(/history-entry-/g) || []).length, 18);
    for (let expected = Math.min(count, 36); ; expected = Math.min(count, expected + 18)) {
      const more = rendered.buttons.find((row) => String(row.children).startsWith('이전 기록'));
      assert.ok(more, 'Hidden stored entries must remain reachable.');
      more.onClick();
      rendered = renderInventoryLog(state, rendered.harness);
      assert.equal((rendered.html.match(/history-entry-/g) || []).length, expected);
      if (expected === count) break;
    }
    assert.ok(rendered.html.includes(`history-entry-${String(count).padStart(3, '0')}`));
    assert.ok(!rendered.buttons.some((row) => String(row.children).startsWith('이전 기록')));
    const recent = rendered.buttons.find((row) => row.children === '최근 기록만 보기');
    assert.ok(recent);
    recent.onClick();
    rendered = renderInventoryLog(state, rendered.harness);
    assert.equal((rendered.html.match(/history-entry-/g) || []).length, 18);
    assert.deepEqual(state, before, 'Log navigation must not mutate the run or spend AP.');
  }
});

check('log expansion resets for a replacement run and handles an empty history', () => {
  const state = freshState('log-old-run');
  state.log = Array.from({ length: 36 }, (_, index) => `old-history-${index}`);
  let rendered = renderInventoryLog(state);
  const more = rendered.buttons.find((row) => String(row.children).startsWith('이전 기록'));
  assert.ok(more);
  more.onClick();
  const replacement = { ...state, runId: 'log-replacement-run',
    founderHistory: { ...state.founderHistory, runId: 'log-replacement-run' },
    log: Array.from({ length: 30 }, (_, index) => `new-history-${index}`) };
  rendered = renderInventoryLog(replacement, rendered.harness);
  assert.equal((rendered.html.match(/new-history-/g) || []).length, 18);
  rendered = renderInventoryLog({ ...replacement, log: [] }, rendered.harness);
  assert.ok(!rendered.buttons.some((row) => String(row.children).startsWith('이전 기록')));
  assert.match(rendered.html, /아직 기록이 없습니다/);
});

check('safe collection controls expose fixed rewards and route the selected resource through the real workspace', () => {
  const state = freshState('focus-safe-gather');
  const original = structuredClone(state);
  const calls = [];
  globalThis.__primitiveArchiveFocusButtons = [];
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, {
    ...tabProps(state, 'actions'), runSafeGather: (id) => calls.push(id),
  }));
  const text = renderedVisibleText(html);
  for (const [id, label] of [['berry', '안전하게 베리 줍기'], ['wood', '안전하게 땔감 줍기']]) {
    const button = globalThis.__primitiveArchiveFocusButtons.find((row) => row.children === label);
    assert.ok(button && !button.disabled);
    button.onClick();
    assert.equal(calls.at(-1), id);
  }
  assert.match(text, /베리 \+2/);
  assert.match(text, /나무 \+1/);
  assert.match(text, /AP 1 · ST 6 · 허기 \+1/);
  const updated = engine.runSafeGatherAction(state, state.party[0].id, calls[0], { rng: () => { throw new Error('No random roll needed'); } });
  assert.equal(updated.inventory.berry, state.inventory.berry + 2);
  assert.equal(updated.ap, state.ap - 1);
  assert.deepEqual(state, original);
  globalThis.__primitiveArchiveFocusButtons = [];
  renderToStaticMarkup(React.createElement(PrimitiveArchiveActionWorkspace, { ...tabProps(state, 'actions'), canAct: false }));
  for (const label of ['안전하게 베리 줍기', '안전하게 땔감 줍기']) {
    assert.equal(globalThis.__primitiveArchiveFocusButtons.find((row) => row.children === label)?.disabled, true);
  }
});

check('reserve guidance exposes separate ration and party nutrition units without displacing urgent or ended states', () => {
  const state = freshState('focus-reserves');
  const inputs = planInputs(state);
  const supplies = { ...inputs.supplies, rationShortage: 2, foodShortage: 9, fuelShortage: true };
  const plan = runPlan({ ...inputs, supplies });
  assert.match(plan.objective.title, /식량·땔감 비축/);
  assert.match(plan.objective.detail, /부족 배식 2단위/);
  assert.match(plan.objective.detail, /대원 저녁 영양 9/);
  assert.equal(plan.objective.targetTab, 'actions');
  const text = renderedVisibleText(renderFocus(plan).html);
  assert.ok(text.includes(supplies.reserveText));
  assert.ok(text.includes(supplies.careText));
  const urgent = { ...inputs, supplies, nightRows: [{ id: state.party[0].id, name: '긴급 대원', currentHp: 4, hp: 0, damage: 4, hungerDamage: 4, coldDamage: 0, hypothermiaDamage: 0 }] };
  assert.match(runPlan(urgent).objective.title, /밤 생존부터/);
  for (const plan of [runPlan({ ...inputs, supplies }, { ready: false }), runPlan({ ...inputs, supplies }, { busy: 'saving' }), runPlan({ ...inputs, supplies, state: { ...state, ended: true } })]) {
    assert.ok(!renderedVisibleText(renderFocus(plan).html).includes(supplies.careText));
  }
});

const playContent = readFileSync(new URL('../src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js', import.meta.url), 'utf8');
assert.match(playContent, /const focusPlan = primitiveArchiveFocusPlan\(/, 'The live page must use the tested focus plan.');
assert.match(playContent, /<PrimitiveArchiveFocusPanel plan=\{focusPlan\} onNavigate=\{setActiveTabId\} \/>\s*<PrimitiveArchiveInventoryBar inventory=\{state\.inventory\} inventoryRows=\{inventoryRows\} \/>\s*<PrimitiveArchiveFeatureTabs/s, 'The live focus panel must be followed by the persistent inventory bar before the real feature tabs.');
assert.match(playContent, /<details className="primitive-guide-details">\s*<summary>상세 생존 안내<\/summary>\s*<GameAdvisorPanel/s, 'Existing detailed survival advice must remain available below the main interface.');

console.log(JSON.stringify({ pass: failures.length === 0, checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
