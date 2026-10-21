import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
globalThis.__primitiveArchiveProgressionReact = React;

const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const progression = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveProgression.js');
const coach = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveCoach.js');
const ERA_IDS = [
  'PRIMITIVE', 'NEOLITHIC', 'ANCIENT', 'CLASSICAL',
  'MEDIEVAL', 'EARLY_MODERN', 'MODERN_EARLY', 'MODERN_LATE',
];
const checks = [];
const failures = [];

const runTabUrl = new URL('../src/app/games/primitive-archive/_components/PrimitiveArchiveRunTab.js', import.meta.url).href;
const tribeTabUrl = new URL('../src/app/games/primitive-archive/_components/PrimitiveArchiveTribeTab.js', import.meta.url).href;
const advisorPanelUrl = new URL('../src/app/games/_components/GameAdvisorPanel.js', import.meta.url).href;
const runTabModules = new Map([
  ['next/link', `const jsx = (...args) => globalThis.__primitiveArchiveProgressionReact.createElement(...args); export default function Link(props) { return jsx('a', props); }`],
  ['../../_components/GamePlayPrimitives', `
    const jsx = (...args) => globalThis.__primitiveArchiveProgressionReact.createElement(...args);
    export function ActionButton(props) { globalThis.__primitiveArchiveProgressionButtons.push(props); return jsx('button', { type: 'button', 'data-action': props.action, disabled: props.disabled, title: props.title, children: props.children }); }
    export function GameControlButton(props) { globalThis.__primitiveArchiveProgressionButtons.push(props); return jsx('button', { type: 'button', 'data-action': props.action, disabled: props.disabled, title: props.title, children: props.children }); }
  `],
  ['../_lib/primitiveArchivePageRuntime', `
    export const FALLBACK_DIFFICULTY_TAGS = {};
    export const multiplierText = (value) => String(value);
    export const startInventoryText = () => '기본 보급';
  `],
  ['./PrimitiveArchiveVisuals', `
    const jsx = (...args) => globalThis.__primitiveArchiveProgressionReact.createElement(...args);
    export function PrimitiveArchivePanelTitle(props) { return jsx('header', { children: props.children }); }
  `],
]);
const tribeTabModules = new Map([
  ['lucide-react', `const icon = (props) => globalThis.__primitiveArchiveProgressionReact.createElement('span', props); export const Minus = icon; export const Plus = icon;`],
  ['../../_components/GameActionIcon', `export default function GameActionIcon() { return null; }`],
  ['../../_components/GamePlayPrimitives', `
    const jsx = (...args) => globalThis.__primitiveArchiveProgressionReact.createElement(...args);
    export function GameControlButton(props) { return jsx('button', { children: props.children, disabled: props.disabled }); }
    export function RecentActionResult(props) { return jsx('p', { children: props.text }); }
    export function SmallStat(props) { return jsx('span', { children: [props.label, ' ', props.value] }); }
  `],
  ['./PrimitiveArchiveVisuals', `
    const jsx = (...args) => globalThis.__primitiveArchiveProgressionReact.createElement(...args);
    export function PrimitiveArchivePanelTitle(props) { return jsx('header', { children: props.title }); }
  `],
]);
const asDataModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === runTabUrl && runTabModules.has(specifier)) {
      return { url: asDataModule(runTabModules.get(specifier)), shortCircuit: true };
    }
    if (context.parentURL === tribeTabUrl && tribeTabModules.has(specifier)) {
      return { url: asDataModule(tribeTabModules.get(specifier)), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url !== runTabUrl && url !== tribeTabUrl && url !== advisorPanelUrl) return nextLoad(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
  },
});
const { default: PrimitiveArchiveRunTab } = await import(runTabUrl);
const { default: PrimitiveArchiveTribeTab } = await import(tribeTabUrl);
const { default: GameAdvisorPanel } = await import(advisorPanelUrl);

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

function fixture(overrides = {}, rng = () => 0.5) {
  const base = engine.createNewState({ rng, runId: 'progression-run', now: '2026-10-21T00:00:00.000Z' });
  return {
    ...base,
    day: 4,
    ap: 2,
    party: base.party.map((member) => ({ ...member, hp: 80, hunger: 15, stamina: 90, bodyTemp: 37 })),
    ...overrides,
  };
}

function basicReadyFixture(overrides = {}) {
  const base = fixture();
  const technologyArchive = Object.fromEntries(engine.TECHNOLOGY_TREE
    .filter((node) => node.archiveRequired)
    .map((node) => [node.id, true]));
  const civicArchive = Object.fromEntries(engine.CIVIC_TREE
    .filter((node) => node.archiveRequired)
    .map((node) => [node.id, true]));
  return {
    ...base,
    day: engine.ARCHIVE_VICTORY_DAY,
    camp: { ...base.camp, archiveRoomLevel: 1, scribeDeskLevel: 1, libraryShelfLevel: 1 },
    inventory: { ...base.inventory, book_craft_guide: 1, book_camp_manual: 1 },
    research: { ...base.research, completed: technologyArchive },
    civics: { ...base.civics, completed: civicArchive },
    ...overrides,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function summarize(state) {
  return progression.archiveProgressionSummary(state, engine.archiveVictorySummary(state));
}

function renderRunTab(state, overrides = {}) {
  globalThis.__primitiveArchiveProgressionButtons = [];
  const difficulty = engine.difficultyRows()[0];
  const props = {
    applyAction() {},
    archiveVictory: engine.archiveVictorySummary(state),
    busy: '',
    currentDifficulty: difficulty,
    hydrated: true,
    newRunDifficulty: state.difficulty,
    recordRun() {},
    selectedDifficulty: difficulty,
    setActiveTabId() {},
    setNewRunDifficulty() {},
    startNewRun() {},
    state,
    token: '',
    ...overrides,
  };
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveRunTab, props));
  return { html, buttons: globalThis.__primitiveArchiveProgressionButtons, props };
}

function actionButton(rendered, action) {
  return rendered.buttons.find((button) => button.action === action);
}

check('existing progression data remains 150 technologies and 94 civics across the original eight eras', () => {
  assert.equal(engine.TECHNOLOGY_TREE.length, 150);
  assert.equal(engine.CIVIC_TREE.length, 94);
  const summary = summarize(fixture());
  assert.deepEqual(summary.longTerm.rows.map((row) => row.id), ERA_IDS);
  assert.equal(summary.longTerm.rows.length, 8);
  assert.equal(summary.longTerm.rows.reduce((sum, row) => sum + row.total, 0), 244);
});

check('a fresh run shows incomplete basic objectives while preserving any initially completed era data', () => {
  const state = fixture();
  const summary = summarize(state);
  assert.equal(summary.basic.completed, engine.archiveVictorySummary(state).completed);
  assert.ok(summary.basic.completed < summary.basic.total);
  assert.equal(summary.basic.total, 5);
  assert.equal(summary.basic.canComplete, false);
  assert.equal(summary.basic.ended, false);
  assert.equal(summary.basic.victory, false);
  assert.ok(summary.longTerm.rows.every((row) => !row.complete));
  assert.equal(engine.runRecordStatus(state).canRecord, false);
});

check('missing archiveVictory fails closed instead of inventing objective progress', () => {
  const result = progression.archiveProgressionSummary(fixture(), undefined);
  assert.deepEqual(result.basic, {
    title: '기초 아카이브 완주',
    description: result.basic.description,
    canComplete: false,
    completed: 0,
    total: 0,
    ended: false,
    victory: false,
  });
  assert.equal(result.basic.description.length > 0, true);
});

check('the basic objective-ready state matches the existing engine summary and remains a living active run', () => {
  const state = basicReadyFixture();
  const existing = engine.archiveVictorySummary(state);
  const result = progression.archiveProgressionSummary(state, existing);
  assert.equal(existing.canComplete, true);
  assert.equal(result.basic.canComplete, existing.canComplete);
  assert.equal(result.basic.completed, existing.completed);
  assert.equal(result.basic.total, existing.total);
  assert.equal(result.basic.ended, false);
  assert.equal(result.basic.victory, false);
  assert.equal(engine.runRecordStatus(state).canRecord, false, 'Basic readiness must not itself create a recordable terminal run.');
  assert.ok(result.longTerm.rows.find((row) => row.id === 'MODERN_LATE').complete === false,
    'Completing the basic objective set must not imply completion of all later-era research.');
});

check('a single late-modern node marks era entry but never marks the entire era complete', () => {
  const node = engine.TECHNOLOGY_TREE.find((item) => item.era === 'MODERN_LATE');
  assert.ok(node);
  const state = fixture({ research: { ...fixture().research, completed: { [node.id]: true } } });
  const lateEra = summarize(state).longTerm.rows.find((row) => row.id === 'MODERN_LATE');
  assert.equal(lateEra.completed, 1);
  assert.ok(lateEra.total > 1);
  assert.equal(lateEra.entered, true);
  assert.equal(lateEra.complete, false);
});

check('a fully completed era reports entry and completion separately', () => {
  const techNodes = engine.TECHNOLOGY_TREE.filter((item) => item.era === 'MODERN_LATE');
  const civicNodes = engine.CIVIC_TREE.filter((item) => item.era === 'MODERN_LATE');
  const researchCompleted = Object.fromEntries(techNodes.map((node) => [node.id, true]));
  const civicCompleted = Object.fromEntries(civicNodes.map((node) => [node.id, true]));
  const base = fixture();
  const state = fixture({
    research: { ...base.research, completed: researchCompleted },
    civics: { ...base.civics, completed: civicCompleted },
  });
  const lateEra = summarize(state).longTerm.rows.find((row) => row.id === 'MODERN_LATE');
  assert.equal(lateEra.completed, techNodes.length + civicNodes.length);
  assert.equal(lateEra.total, techNodes.length + civicNodes.length);
  assert.equal(lateEra.entered, true);
  assert.equal(lateEra.complete, true);
});

check('settled unfinished survivor and total-loss states keep their distinct run-record results', () => {
  const unfinished = engine.settleRunAction(fixture());
  const defeat = engine.settleRunAction(fixture({ ended: true, party: fixture().party.map((member) => ({ ...member, hp: 0 })) }));
  assert.equal(summarize(unfinished).basic.ended, true);
  assert.equal(summarize(unfinished).basic.victory, false);
  assert.equal(engine.runRecordStatus(unfinished).result, 'none');
  assert.equal(engine.runRecordStatus(unfinished).label, '미완성 정산');
  assert.equal(summarize(defeat).basic.ended, true);
  assert.equal(summarize(defeat).basic.victory, false);
  assert.equal(engine.runRecordStatus(defeat).result, 'fail');
  assert.equal(engine.runRecordStatus(defeat).label, '실패');
});

check('completion settlement rewards and clear-record classification retain the existing engine contract', () => {
  const ready = basicReadyFixture();
  const original = structuredClone(ready);
  const completed = engine.completeArchiveAction(ready);
  const progressionAfter = summarize(completed);
  assert.equal(completed.ended, true);
  assert.equal(completed.victory, true);
  assert.equal(completed.meta.runsCompleted, original.meta.runsCompleted + 1);
  const normalizedReady = engine.normalizeState(ready);
  const expectedAward = Math.max(3, Math.floor(engine.scoreState({ ...normalizedReady, victory: true }) / 700));
  assert.equal(completed.meta.lastAward, expectedAward);
  assert.equal(completed.meta.perkPoints, original.meta.perkPoints + expectedAward);
  assert.equal(progressionAfter.basic.ended, true);
  assert.equal(progressionAfter.basic.victory, true);
  assert.equal(engine.runRecordStatus(completed).result, 'clear');
  assert.deepEqual(ready, original, 'Completion must preserve the input state.');
});

check('the helper only reads frozen source state and consumes no RNG after the engine summary is prepared', () => {
  let draws = 0;
  const state = fixture({}, () => { draws += 1; return 0.5; });
  const engineSummary = engine.archiveVictorySummary(state);
  const drawsAfterExistingSummary = draws;
  const before = structuredClone(state);
  deepFreeze(state);
  progression.archiveProgressionSummary(state, engineSummary);
  assert.equal(draws, drawsAfterExistingSummary);
  assert.deepEqual(state, before);
});

check('controlled RunTab SSR separates basic completion from optional era progression and keeps details collapsed', () => {
  const state = basicReadyFixture();
  const rendered = renderRunTab(state);
  const complete = actionButton(rendered, 'complete');
  const growth = actionButton(rendered, 'research');
  assert.match(rendered.html, /기초 아카이브 완성·런 종료/);
  assert.match(rendered.html, /아카이브 완성/);
  assert.match(rendered.html, /문명 발전 계속/);
  assert.equal(complete.disabled, false);
  assert.equal(growth.disabled, false);
  const detailsTag = rendered.html.match(/<details[^>]*>/)?.[0];
  assert.ok(detailsTag);
  assert.doesNotMatch(detailsTag, /\sopen(?:=|\s|>)/);
  for (const row of summarize(state).longTerm.rows) assert.match(rendered.html, new RegExp(row.label));
  assert.equal((rendered.html.match(/<li>/g) || []).length, 8);
});

check('completion action preserves metadata, guards readiness, and asks before ending the run', () => {
  const ready = basicReadyFixture();
  const beforeAp = ready.ap;
  const actions = [];
  let confirmResult = false;
  let confirmText = '';
  const originalWindow = globalThis.window;
  globalThis.window = { confirm(text) { confirmText = text; return confirmResult; } };
  try {
    const rendered = renderRunTab(ready, {
      applyAction(label, updater) { actions.push({ label, result: updater(ready) }); },
    });
    const complete = actionButton(rendered, 'complete');
    complete.onClick();
    assert.equal(actions.length, 0, 'Declining confirmation must not dispatch a mutation.');
    assert.match(confirmText, /종료.*문명 발전.*이어갈 수 없습니다/);
    assert.equal(complete.action, 'complete');
    confirmResult = true;
    complete.onClick();
    assert.equal(actions.length, 1);
    assert.equal(actions[0].label, '아카이브 완성', 'The action metadata remains stable for existing analytics.');
    assert.equal(actions[0].result.ended, true);
    assert.equal(ready.ap, beforeAp, 'The action must not mutate the active state or spend AP.');

    for (const overrides of [
      { hydrated: false },
      { busy: 'save' },
      { state: { ...ready, ended: true } },
      { archiveVictory: { ...engine.archiveVictorySummary(ready), canComplete: false } },
    ]) {
      const blocked = renderRunTab(ready, overrides);
      const blockedButton = actionButton(blocked, 'complete');
      assert.equal(blockedButton.disabled, true);
      const before = actions.length;
      blockedButton.onClick();
      assert.equal(actions.length, before, 'Guarded completion must never dispatch.');
    }
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

check('continuation changes to the growth tab only and guest note distinguishes local autosave from server features', () => {
  const state = fixture();
  const before = structuredClone(state);
  const selectedTabs = [];
  const rendered = renderRunTab(state, { setActiveTabId: (id) => selectedTabs.push(id) });
  actionButton(rendered, 'research').onClick();
  assert.deepEqual(selectedTabs, ['growth']);
  assert.deepEqual(state, before, 'Changing tabs must not advance the run or spend AP.');
  assert.match(rendered.html, /이 기기에 자동 저장/);
  assert.match(rendered.html, /서버 저장·서버 불러오기·전적 기록은 로그인 후/);
});

check('controlled TribeTab SSR labels its forecast as tribe-only and states the excluded food sources', () => {
  const state = fixture();
  const tribe = engine.tribeSummary(state);
  const html = renderToStaticMarkup(React.createElement(PrimitiveArchiveTribeTab, {
    actionFeedback: null,
    adjustTribeJob() {},
    recentActionText: '',
    rivals: [],
    runDiplomacy() {},
    tribe,
  }));
  assert.match(html, /부족 전용 식량 전망\(2일\)/);
  assert.match(html, /파티 식사분·인구 증가·추가 행동·사업 보상은 포함하지 않습니다/);
});

check('coach prioritizes one living low-HP member even when the party average remains healthy', () => {
  const state = fixture({ party: [
    { ...fixture().party[0], name: '위험 대원', hp: 25 },
    { ...fixture().party[1], hp: 95 },
    { ...fixture().party[2], hp: 95 },
  ] });
  const before = structuredClone(state);
  deepFreeze(state);
  const message = coach.primitiveArchiveCoachMessage({ state });
  assert.equal(message.urgent, true);
  assert.equal(message.title, '회복 먼저 검토');
  assert.match(message.text, /위험 대원의 HP가 25/);
  assert.ok(state.party.reduce((sum, member) => sum + member.hp, 0) / state.party.length > 35);
  assert.deepEqual(state, before);
});

check('fatal night loss takes priority over low HP, hunger, and other night damage', () => {
  const state = fixture({ party: [
    { ...fixture().party[0], name: '야간 위험 대원', hp: 20, hunger: 85 },
    { ...fixture().party[1], hp: 80, hunger: 10 },
  ] });
  const rows = [
    { name: '야간 위험 대원', currentHp: 20, hp: 0, damage: 20, coldDamage: 8, hungerDamage: 12, hypothermiaDamage: 0 },
    { name: '다른 대원', currentHp: 80, hp: 70, damage: 10, coldDamage: 10, hungerDamage: 0, hypothermiaDamage: 0 },
  ];
  deepFreeze(state);
  deepFreeze(rows);
  const message = coach.primitiveArchiveCoachMessage({ state, nightRows: rows });
  assert.equal(message.title, '밤 생존 위험');
  assert.equal(message.urgent, true);
  assert.match(message.text, /야간 위험 대원: 현재 상태로 밤을 보내면 HP 20 → 0 예상/);
});

check('coach prioritizes hunger over nonfatal night damage and gives safe early-day guidance', () => {
  const state = fixture({ day: 2, party: [
    { ...fixture().party[0], name: '허기 대원', hp: 80, hunger: 75 },
  ] });
  const rows = [{ name: '허기 대원', currentHp: 80, hp: 70, damage: 10, coldDamage: 4, hungerDamage: 6, hypothermiaDamage: 0 }];
  const message = coach.primitiveArchiveCoachMessage({ state, nightRows: rows });
  assert.equal(message.title, '식량·식사 확인');
  assert.match(message.text, /보유량과 식사 행동/);

  const intro = coach.primitiveArchiveCoachMessage({ state: fixture({ day: 1 }) });
  assert.equal(intro.urgent, false);
  assert.equal(intro.title, '첫 사흘의 선택');
  assert.match(intro.text, /모닥불은 연료가 있어야 따뜻합니다/);
});

check('nonfatal night guidance includes a damage breakdown and Day 4 uses the supplied fallback', () => {
  const state = fixture({ party: [{ ...fixture().party[0], name: '밤 피해 대원', hunger: 40 }] });
  const row = { name: '밤 피해 대원', currentHp: 80, hp: 68, damage: 12, coldDamage: 3, hungerDamage: 5, hypothermiaDamage: 4 };
  const message = coach.primitiveArchiveCoachMessage({ state, nightRows: [row] });
  assert.equal(message.title, '밤 피해 예상');
  assert.match(message.text, /밤 예상 피해 12 \(추위 3·허기 5·저체온 4\)/);

  for (const day of [1, 2, 3]) {
    const intro = coach.primitiveArchiveCoachMessage({ state: fixture({ day }) });
    assert.equal(intro.title, '첫 사흘의 선택');
  }
  const fallback = coach.primitiveArchiveCoachMessage({ state: fixture({ day: 4 }), fallbackText: '지역별 제작 안내' });
  assert.equal(fallback.urgent, false);
  assert.equal(fallback.title, '');
  assert.equal(fallback.text, '지역별 제작 안내');
});

check('ended coach state passes fallback through and leaves the state untouched', () => {
  const state = fixture({ ended: true });
  const before = structuredClone(state);
  assert.deepEqual(coach.primitiveArchiveCoachMessage({ state, nightRows: [{ currentHp: 40, hp: 0 }], fallbackText: '종료 안내' }), {
    urgent: false,
    title: '',
    text: '종료 안내',
  });
  assert.deepEqual(state, before);
});

check('actual compact advisor SSR shows real urgent coach output while details stay collapsed', () => {
  const state = fixture({ party: [{ ...fixture().party[0], name: '표시 대상', hp: 18 }] });
  const message = coach.primitiveArchiveCoachMessage({ state });
  const html = renderToStaticMarkup(React.createElement(GameAdvisorPanel, {
    title: '생존 코치',
    primaryTitle: message.title,
    primaryText: message.text,
    adviceLines: [{ kind: '우선', title: message.title, detail: message.text }],
    compact: true,
    minimal: true,
    storageKey: 'primitive-archive-survival-coach',
  }));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /회복 먼저 검토/);
  assert.match(html, /표시 대상의 HP가 18입니다/);
  assert.doesNotMatch(html, /game-advisor-details/);
});

check('PlayContent wires coach output to the live guide and preserves compact collapsed advisor presentation', () => {
  const source = readFileSync(new URL('../src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js', import.meta.url), 'utf8');
  assert.match(source, /primitiveArchiveCoachMessage\(\{\s*state,\s*nightRows:\s*partyView\.map\(\(row\) => row\.nightSurvival\)\.filter\(Boolean\),/);
  assert.match(source, /coachMessage\.urgent \? coachMessage\.title/);
  assert.match(source, /:\s*coachMessage\.text,/);
  assert.match(source, /<GameAdvisorPanel \{\.\.\.guide\} compact minimal storageKey="primitive-archive-survival-coach" \/>/);
});

console.log(JSON.stringify({ pass: failures.length === 0, checks: checks.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
