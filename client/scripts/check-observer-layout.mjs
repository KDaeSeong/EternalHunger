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
  '../src/app/games/_components/GameActionIcon.js',
].map((path) => new URL(path, import.meta.url).href));
registerHooks({ load(url, context, nextLoad) {
  if (!components.has(url)) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: Control } = await import('../src/app/simulation/_components/SimulationControlPanel.js');
const { default: Seed } = await import('../src/app/simulation/_components/SimulationMarketSeedCard.js');
const readComponent = (name) => readFileSync(new URL(`../src/app/simulation/_components/${name}.js`, import.meta.url), 'utf8');
const seedProps = { day: 0, matchSec: 0, runSeed: 'observer-layout-1', seedDraft: 'observer-layout-1' };
const render = (props = {}) => renderToStaticMarkup(React.createElement(Control, {
  day: 0, matchSec: 0, autoSpeed: 32, matchMode: 'squad', characterSkillsEnabled: true,
  settingsContent: React.createElement(Seed, { ...seedProps, ...props }), ...props,
}));
const normal = render();
let passed = 0;
const check = (name, run) => { run(); passed += 1; console.log(`PASS ${name}`); };
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
console.log(JSON.stringify({ passed, scope: 'actual controls SSR and ownership checks; viewport fit and interaction require browser checks' }));
