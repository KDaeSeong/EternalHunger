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
const runTabUrl = new URL('_components/PrimitiveArchiveRunTab.js', routeUrl).href;
const campWorkspaceUrl = new URL('_components/PrimitiveArchiveCampWorkspace.js', routeUrl);
const growthTabUrl = new URL('_components/PrimitiveArchiveGrowthTab.js', routeUrl);
const researchPreviewUrl = new URL('_components/PrimitiveArchiveResearchTreePreview.js', routeUrl);
const transpiledUrls = new Set([focusPanelUrl, featureTabsUrl, actionWorkspaceUrl, runTabUrl]);
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

check('actual navigation JSX exposes three primary tabs, keeps other screens collapsed, and labels a secondary active pane', () => {
  const state = freshState('focus-tab-navigation');
  const primary = renderFeatureTabs(state, 'actions');
  const primaryList = primary.html.match(/<div[^>]*role="tablist" aria-label="주요 화면"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  assert.ok(primaryList, 'The real primary tablist must render.');
  assert.deepEqual([...primaryList.matchAll(/<button[^>]*role="tab"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g)].map((match) => match[1]), ['행동', '캠프', '발전']);
  assert.equal((primaryList.match(/role="tab"/g) || []).length, 3);
  const secondaryDetails = primary.html.match(/<details class="primitive-secondary-navigation"([^>]*)>/)?.[0];
  assert.ok(secondaryDetails);
  assert.doesNotMatch(secondaryDetails, /\sopen(?:=|\s|>)/, 'Secondary navigation must start collapsed.');
  assert.match(primary.html, /role="tabpanel" aria-labelledby="primitive-archive-tab-actions"/);

  const secondary = renderFeatureTabs(state, 'run');
  assert.match(secondary.html, /<button[^>]*role="tab"[^>]*id="primitive-archive-tab-run"[^>]*aria-selected="true"/);
  assert.match(secondary.html, /role="tabpanel" aria-labelledby="primitive-archive-tab-run"/);
  assert.match(secondary.html, /런 관리/);
  assert.match(secondary.html, /id="primitive-archive-tab-run"/);
  assert.match(secondary.html, /<details class="primitive-secondary-navigation"[^>]*>/);
  assert.doesNotMatch(secondary.html.match(/<details class="primitive-secondary-navigation"[^>]*>/)?.[0] || '', /\sopen(?:=|\s|>)/);
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
assert.match(playContent, /<PrimitiveArchiveFocusPanel plan=\{focusPlan\} onNavigate=\{setActiveTabId\} \/>\s*<PrimitiveArchiveFeatureTabs/s, 'The live focus panel must render immediately before the real feature tabs.');
assert.match(playContent, /<details className="primitive-guide-details">\s*<summary>상세 생존 안내<\/summary>\s*<GameAdvisorPanel/s, 'Existing detailed survival advice must remain available below the main interface.');

console.log(JSON.stringify({ pass: failures.length === 0, checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
