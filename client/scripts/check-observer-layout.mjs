import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const components = new Set([
  '../src/app/simulation/_components/SimulationControlPanel.js',
  '../src/app/simulation/_components/SimulationMarketSeedCard.js',
  '../src/app/simulation/_components/SimulationSurvivorBoard.js',
  '../src/app/games/_components/GameActionIcon.js',
].map((path) => new URL(path, import.meta.url).href));
registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier === 'next/image' ? 'next/image.js' : specifier, context);
}, load(url, context, nextLoad) {
  if (!components.has(url)) return nextLoad(url, context);
  // Next's bundler unwraps this CJS default; native Node ESM does not. Keep
  // the real Next Image component rather than replacing it with a test mock.
  const source = readFileSync(new URL(url), 'utf8').replace("import Image from 'next/image';",
    "import NextImage from 'next/image'; const Image = NextImage.default || NextImage;");
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: Control } = await import('../src/app/simulation/_components/SimulationControlPanel.js');
const { default: Seed } = await import('../src/app/simulation/_components/SimulationMarketSeedCard.js');
const { default: SurvivorBoard } = await import('../src/app/simulation/_components/SimulationSurvivorBoard.js');
const { buildActorTeamState } = await import('../src/app/simulation/_lib/simulationPageRuntime.js');
const readComponent = (name) => readFileSync(new URL(`../src/app/simulation/_components/${name}.js`, import.meta.url), 'utf8');
const seedProps = { day: 0, matchSec: 0, runSeed: 'observer-layout-1', seedDraft: 'observer-layout-1' };
const render = (props = {}) => renderToStaticMarkup(React.createElement(Control, {
  day: 0, matchSec: 0, autoSpeed: 32, matchMode: 'squad', characterSkillsEnabled: true,
  settingsContent: React.createElement(Seed, { ...seedProps, ...props }), ...props,
}));
const normal = render();
let passed = 0;
const check = (name, run) => { run(); passed += 1; console.log(`PASS ${name}`); };
check('map preparation locks manual and auto start with a distinct readying label', () => {
  const html = render({ mapPreparation: { name: 'Preparing' }, isAdvancing: true, actionDisabled: true, autoDisabled: true, speedDisabled: true });
  assert.match(html, /지도 준비 중/);
  assert.match(html, /class="btn-proceed"[^>]*disabled=""/);
  assert.match(html, /title="오토 진행은[^>]*disabled=""|disabled=""[^>]*title="오토 진행은/);
  assert.match(readComponent('SimulationMainStage'), /autoDisabled=\{Boolean\(mapPreparation\)/);
});
check('ordinary in-progress autoplay remains stoppable outside map preparation', () => {
  const html = render({ isAdvancing: true, actionDisabled: true, autoPlay: true, autoDisabled: false });
  assert.match(html, /오토 정지/);
  const autoButton = html.match(/<button[^>]*title="오토 진행은[^>]*>/)?.[0];
  assert.ok(autoButton); assert.doesNotMatch(autoButton, /disabled/);
});
check('one primary action; no duplicate header action', () => {
  assert.equal((normal.match(/class="btn-proceed"/g) || []).length, 1);
  assert.doesNotMatch(readComponent('SimulationScreenHeader'), /sim-header-proceed|onProceed/);
});
check('play and speed remain outside collapsed settings', () => {
  const settingsStart = normal.indexOf('<details');
  assert.ok(settingsStart > normal.indexOf('class="btn-proceed"'));
  assert.ok(settingsStart > normal.indexOf('최대 32배속'));
  assert.match(normal, /<details name="simulation-tools" class="simulation-match-settings"><summary>/);
});
check('pregame mode, skills, prediction and seed are still available', () => {
  for (const text of ['스쿼드', '솔로', '캐릭터 스킬', '승자 예측', '경기 시드', '새 시드', 'observer-layout-1']) assert.ok(normal.includes(text), text);
  assert.match(normal, /aria-label="경기 시드"[^>]*value="observer-layout-1"/);
});
check('authenticated prediction explains server-confirmed rewards, not a guaranteed credit', () => {
  const html = render({ guestMode: false });
  assert.match(html, /계정 경기 저장 성공 시 기본 50LP · 예측 성공 \+100LP/);
  assert.doesNotMatch(html, /영구 LP 보상 없음|계정 LP 보상 없음/);
});
check('guest and developer-manipulated matches do not advertise account rewards', () => {
  for (const props of [{ guestMode: true }, { guestMode: false, devRunTainted: true }, {}]) {
    const html = render(props);
    assert.match(html, /계정 LP 보상 없음/);
    assert.doesNotMatch(html, /기본 50LP|예측 성공 \+100LP/);
  }
  assert.match(render({ guestMode: true }), /비로그인 경기/);
  assert.match(render({ guestMode: false, devRunTainted: true }), /개발자 조작 경기/);
});
check('prediction help retains the started-match lock and receives existing session context', () => {
  assert.match(render({ guestMode: false, matchSec: 10 }), /경기 시작 후 변경 불가/);
  const source = readComponent('SimulationMainStage');
  const controls = source.slice(source.indexOf('<SimulationControlPanel'));
  assert.match(controls, /guestMode=\{guestMode\}/);
  assert.match(controls, /devRunTainted=\{devRunTainted\}/);
  const stage = readComponent('SimulationGameScreen').slice(readComponent('SimulationGameScreen').indexOf('<SimulationMainStage'));
  assert.match(stage, /guestMode=\{guestMode\}/);
  assert.match(stage, /devRunTainted=\{devRunTainted\}/);
});
check('replay preserves read-only input and removes prediction', () => {
  const html = render({ replayMode: true, matchModeDisabled: true, characterSkillsDisabled: true });
  assert.match(html, /현재 경기는 시작 조건이 고정/);
  assert.doesNotMatch(html, /승자 예측|aria-label="경기 시드"/);
  assert.match(html, /type="checkbox"[^>]*disabled=""/);
});
check('evaluation has one start, speed, and no editable settings or separate auto button', () => {
  const html = render({ evaluationMode: true });
  assert.match(html, /평가 시작/);
  assert.match(html, /최대 32배속/);
  assert.doesNotMatch(html, /simulation-match-settings|title="오토 진행은|승자 예측/);
  assert.equal((html.match(/<button\b/g) || []).length, 1);
});
check('evaluation running state exposes stop without mutable settings', () => {
  const html = render({ evaluationMode: true, day: 1, autoPlay: true });
  assert.match(html, /오토 정지/);
  assert.doesNotMatch(html, /simulation-match-settings/);
});
check('editable evaluation variants retain their explicit setup', () => {
  const html = render({ evaluationMode: true, draftMode: true });
  assert.match(html, /simulation-match-settings/);
  assert.match(html, /aria-label="경기 시드"/);
  assert.doesNotMatch(html, /승자 예측/);
});
check('end state has only one restart and preserves disabled speed', () => {
  const html = render({ isGameOver: true, speedDisabled: true, autoDisabled: true });
  assert.equal((html.match(/class="btn-restart"/g) || []).length, 1);
  assert.doesNotMatch(html, /class="btn-proceed"/);
  assert.match(html, /class="autoplay-speed"[^>]*disabled=""/);
});
check('controls precede the battlefield, setup retains roster and map editors', () => {
  const source = readComponent('SimulationMainStage');
  const returned = source.slice(source.indexOf('  return ('));
  assert.ok(returned.indexOf('<SimulationControlPanel') < returned.indexOf('{battlefield}'));
  assert.match(source, /settingsContent=\{pregameSettings\}/);
  assert.match(source, /const pregameSettings = <>[\s\S]*seedControl[\s\S]*SimulationPregameRosterSetup[\s\S]*SimulationPregameMapRulesSetup/);
});
check('settings disclosure closes on play and keyboard escape', () => {
  const source = readComponent('SimulationControlPanel');
  assert.match(source, /closeSettings\(\); onProceed\?\.\(\)/);
  assert.match(source, /closeSettings\(\); onToggleAutoPlay\?\.\(\)/);
  assert.match(source, /event.key !== 'Escape' \|\| event.target.closest\('\[role="dialog"\]'\)/);
  assert.match(source, /querySelector\('summary'\)\?\.focus\(\)/);
});
check('log heading and limit notice have separate wrapping space', () => {
  const styles = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');
  assert.match(styles, /\.simulation-page--observer \.log-toolbar-title \{[^}]*white-space: normal;[^}]*overflow: visible;/);
  assert.match(styles, /\.simulation-page--observer \.log-toolbar-limit \{[^}]*flex: 1 0 100%;[^}]*color: #b9cfdc;/);
  assert.match(styles, /\.simulation-page--observer \.log-scroll-area \{[^}]*padding-bottom: 52px;/);
});

const boardActor = (name, teamId, teamSlot, hp = 100, extra = {}) => ({
  _id: name, name, teamId, teamSlot, hp, maxHp: 100, zoneId: 'hospital', inventory: [], ...extra,
});
const renderBoard = (survivors, dead, settings = { matchMode: 'squad' }) => renderToStaticMarkup(React.createElement(SurvivorBoard, {
  survivors, dead, settings, uiModal: 'chars', killCounts: {}, getZoneName: zoneId => zoneId,
  getTeamStateForActor: actor => buildActorTeamState(actor, settings, survivors, dead),
}));
const assertCardOrder = (html, names) => {
  const positions = names.map(name => html.indexOf(`<span>${name}</span>`));
  assert.ok(positions.every(position => position >= 0), 'Keep every participant visible.');
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index], `${names[index - 1]} must appear before ${names[index]}.`);
  }
};
check('dead cards use numeric team and original member order, not elimination order', () => {
  const dead = [boardActor('dead-10-2', 'team:10', 2, 0), boardActor('dead-2-3', 'team:2', 3, 0),
    boardActor('dead-1-2', 'team:1', 2, 0), boardActor('dead-2-1', 'team:2', 1, 0), boardActor('dead-10-1', 'team:10', 1, 0)];
  const before = structuredClone(dead);
  const html = renderBoard([], Object.freeze(dead));
  assertCardOrder(html, ['dead-1-2', 'dead-2-1', 'dead-2-3', 'dead-10-1', 'dead-10-2']);
  assert.match(html, /사망자 \(5명\)/); assert.deepEqual(dead, before);
});
check('living cards use the same team order without changing HP, roster, or death separation', () => {
  const survivors = [boardActor('alive-2-2', 'team:2', 2), boardActor('alive-1-3', 'team:1', 3, 17),
    boardActor('alive-2-1', 'team:2', 1)];
  const dead = [boardActor('dead-1-1', 'team:1', 1, 0)];
  const before = structuredClone({ survivors, dead });
  const html = renderBoard(Object.freeze(survivors), Object.freeze(dead));
  assertCardOrder(html, ['alive-1-3', 'alive-2-1', 'alive-2-2', 'dead-1-1']);
  assert.match(html, /생존자 \(3명\)/); assert.match(html, /17\/100/);
  assert.match(html, /사망자 \(1명\)/); assert.match(html, /팀 번호 · 팀원 순서로 표시/);
  assert.deepEqual({ survivors, dead }, before);
});
check('custom team names sort naturally and missing slots use the saved original roster order', () => {
  const actor = (name, teamId, teamName, order) => boardActor(name, teamId, undefined, 0, { teamName, matchTeamRosterIds: order });
  const dead = [actor('custom-10-b', 'custom:10', '부대 10', ['custom-10-a', 'custom-10-b']),
    actor('custom-2-b', 'custom:2', '부대 2', ['custom-2-a', 'custom-2-b']),
    actor('custom-10-a', 'custom:10', '부대 10', ['custom-10-a', 'custom-10-b']),
    actor('custom-2-a', 'custom:2', '부대 2', ['custom-2-a', 'custom-2-b'])];
  assertCardOrder(renderBoard([], dead), ['custom-2-a', 'custom-2-b', 'custom-10-a', 'custom-10-b']);
});
check('explicit one-based slots and saved roster fallbacks share the same member order', () => {
  const rosterIds = ['mixed-a', 'mixed-b', 'mixed-c'];
  const dead = [boardActor('mixed-b', 'team:2', undefined, 0, { matchTeamRosterIds: rosterIds }),
    boardActor('mixed-c', 'team:2', 3, 0), boardActor('mixed-a', 'team:2', 1, 0)];
  assertCardOrder(renderBoard([], dead), rosterIds);
});
check('solo and empty boards preserve their existing order and do not advertise squad grouping', () => {
  const dead = [boardActor('solo-b', 'team:2', 1, 0), boardActor('solo-a', 'team:1', 1, 0)];
  const html = renderBoard([], dead, { matchMode: 'SOLO' });
  assertCardOrder(html, ['solo-b', 'solo-a']); assert.doesNotMatch(html, /팀 번호 · 팀원 순서로 표시/);
  const empty = renderBoard(null, undefined);
  assert.match(empty, /생존자 \(0명\)/); assert.match(empty, /사망자 \(0명\)/);
});
console.log(JSON.stringify({ passed, scope: 'actual controls SSR and ownership checks; viewport fit and interaction require browser checks' }));
