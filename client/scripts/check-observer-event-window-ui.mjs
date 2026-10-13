import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { createHandlerHarness, useMemo, useRef, useState } from './lib/hook-handler-harness.mjs';

const mainStageUrl = new URL('../src/app/simulation/_components/SimulationMainStage.js', import.meta.url).href;
const harnessUrl = new URL('./lib/hook-handler-harness.mjs', import.meta.url).href;
const childNames = ['SimulationTeamObserverPanel', 'SimulationPhaseHighlights', 'SimulationControlPanel',
  'SimulationLogPanel', 'SimulationMatchStatusPanel', 'SimulationMinimapPanel', 'SimulationPregameRosterSetup',
  'SimulationPregameMapRulesSetup', 'SimulationWorldSpawnToolbar'];
const childUrls = new Map(childNames.map((name) => [new URL(`../src/app/simulation/_components/${name}.js`, import.meta.url).href, name]));
const measurements = { 'observer.eventWindow': 0, 'observer.teamModel': 0 };
globalThis.__observerWindowBuilds = 0;
globalThis.__observerModelBuilds = 0;
globalThis.__observerPanelProps = null;

registerHooks({ load(url, context, nextLoad) {
  if (childUrls.has(url)) {
    const name = childUrls.get(url);
    const capture = name === 'SimulationTeamObserverPanel'
      ? 'globalThis.__observerPanelProps = props;' : '';
    return { format: 'module', shortCircuit: true,
      source: `export default function ${name}(props) { ${capture} return null; }` };
  }
  if (url !== mainStageUrl) return nextLoad(url, context);
  let source = readFileSync(new URL(url), 'utf8');
  source = source.replace("import { useId, useMemo, useRef, useState } from 'react';",
    `import { useMemo, useRef, useState } from '${harnessUrl}';\nconst useId = () => 'observer-window-test';`);
  source = source.replace("import { buildTeamObserverEventWindow, buildTeamObserverModel } from '../_lib/teamObserverRuntime';",
    `import { buildTeamObserverEventWindow as actualBuildTeamObserverEventWindow, buildTeamObserverModel as actualBuildTeamObserverModel } from '../_lib/teamObserverRuntime';\n` +
    `const buildTeamObserverEventWindow = (...args) => { globalThis.__observerWindowBuilds++; return actualBuildTeamObserverEventWindow(...args); };\n` +
    `const buildTeamObserverModel = (...args) => { globalThis.__observerModelBuilds++; return actualBuildTeamObserverModel(...args); };`);
  source = `const React = { Fragment: Symbol.for('observer-test.fragment'), createElement(type, props, ...children) {\n` +
    `  const nextProps = { ...(props || {}), children: children.length === 1 ? children[0] : children };\n` +
    `  return typeof type === 'function' ? type(nextProps) : { type, props: nextProps };\n} };\n` + source;
  const transpiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  return { format: 'module', shortCircuit: true, source: transpiled };
} });

const { default: SimulationMainStage } = await import(mainStageUrl);
const { subscribeObserverWorkMeasurements } = await import('../src/app/simulation/_lib/observerWorkMeasurementRuntime.js');
const actor = (id, teamId, hp = 100) => ({ _id: id, name: id, teamId, hp, maxHp: 100, zoneId: 'a', inventory: [], equipped: {} });
const event = (kind, sec, who, itemName) => ({ kind, at: { sec, day: 1, phase: 'morning' }, who, itemName });
const runEvents = [event('craft', 1, 'a', '이전 경기 제작'), event('craft', 2, 'c', '팀원 제작')];
const props = {
  day: 1, phase: 'morning', matchSec: 2, survivors: [actor('a', 'team:1'), actor('c', 'team:1'), actor('b', 'team:2')], dead: [],
  runEvents, settings: {}, publicItems: [], killCounts: {}, assistCounts: {}, isGameOver: false, getZoneName: (id) => String(id),
  spawnState: { coreNodes: [] }, forbiddenNow: new Set(), zones: [], zoneEdges: [], zonePos: {}, activeMap: null,
  activeMapId: '', maps: [], logs: [], recentMoveTrails: [], recentPings: [], hyperloopDestIds: [],
  setAutoPlay() {}, setWinnerPredictionId() {}, handleMatchModeChange() {}, handleCharacterSkillsToggle() {},
  proceedPhaseGuarded() {}, updateAutoSpeed() {}, setUiModal() {}, setHyperloopDestId() {}, closeUiModal() {},
  selectLocalMap() {}, removeLocalMap() {}, saveLocalMap() {}, onLocalRulesChanged() {}, onToggleDevTools() {},
  getTeamStateForActor() { return null; }, doHyperloopJump() {},
};
const harness = createHandlerHarness(SimulationMainStage, props);
const stopProbe = subscribeObserverWorkMeasurements(() => 1, ({ name }) => {
  if (Object.hasOwn(measurements, name)) measurements[name]++;
});
const beforeBuilds = () => ({ window: globalThis.__observerWindowBuilds, model: globalThis.__observerModelBuilds });
const counts = () => ({ ...measurements });
const walk = (node, predicate, found = []) => {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) { node.forEach((item) => walk(item, predicate, found)); return found; }
  if (predicate(node)) found.push(node);
  walk(node.props?.children, predicate, found);
  return found;
};
const clickTab = (label) => {
  const tab = walk(harness.tree, (node) => node.type === 'button' && node.props?.role === 'tab'
    && node.props.children === label)[0];
  assert.ok(tab, `${label} observer tab exists in the real component tree`);
  tab.props.onClick();
  harness.flush();
};

try {
  harness.flush();
  assert.deepEqual(beforeBuilds(), { window: 1, model: 1 });
  assert.deepEqual(counts(), { 'observer.eventWindow': 1, 'observer.teamModel': 1 });
  assert.ok(globalThis.__observerPanelProps?.model?.recent.some((row) => /이전 경기 제작/.test(row.text)));

  for (let frame = 1; frame <= 20; frame++) {
    props.matchSec = 2 + frame;
    props.survivors = props.survivors.map((row) => ({ ...row, hp: Math.max(1, 100 - frame) }));
    harness.dirty = true;
    harness.flush();
  }
  assert.deepEqual(beforeBuilds(), { window: 1, model: 21 }, 'same event-array identity reuses one window while every frame rebuilds the live model');
  assert.equal(counts()['observer.eventWindow'], 1);
  assert.equal(counts()['observer.teamModel'], 21);
  assert.equal(globalThis.__observerPanelProps.model.members.find((row) => row.id === 'a').hp, 80);

  props.runEvents = [...props.runEvents, event('craft', 22, 'a', '교체 기록')];
  harness.dirty = true; harness.flush();
  assert.deepEqual(beforeBuilds(), { window: 2, model: 22 }, 'replacing the source array creates a fresh event window');
  assert.ok(globalThis.__observerPanelProps.model.recent.some((row) => /교체 기록/.test(row.text)));

  globalThis.__observerPanelProps.onTeamChange('team:2');
  harness.flush();
  assert.deepEqual(beforeBuilds(), { window: 3, model: 23 }, 'changing watched membership creates a fresh member-scoped window');
  assert.deepEqual(globalThis.__observerPanelProps.model.trackedActorIds, ['b']);

  const beforeHide = beforeBuilds();
  const beforeHideMeasures = counts();
  clickTab('경기 현황');
  assert.deepEqual(beforeBuilds(), beforeHide, 'non-team tabs do not construct the window or team model');
  assert.deepEqual(counts(), beforeHideMeasures, 'inactive tab memo branches skip both measured helpers');
  clickTab('전체 로그');
  assert.deepEqual(beforeBuilds(), beforeHide, 'logs tab also leaves both expensive builders unused');
  assert.deepEqual(counts(), beforeHideMeasures);
  clickTab('팀 관전');
  assert.deepEqual(beforeBuilds(), { window: 4, model: 24 }, 'returning to team observation builds a fresh window/model');
  assert.equal(counts()['observer.eventWindow'], beforeHideMeasures['observer.eventWindow'] + 1);
  assert.equal(counts()['observer.teamModel'], beforeHideMeasures['observer.teamModel'] + 1);

  props.runEvents = [event('craft', 1, 'b', '새 경기 기록')];
  props.matchSec = 1;
  harness.dirty = true; harness.flush();
  assert.deepEqual(beforeBuilds(), { window: 5, model: 25 }, 'new-match source replacement resets the indexed window');
  assert.ok(globalThis.__observerPanelProps.model.recent.some((row) => /새 경기 기록/.test(row.text)));
  assert.ok(globalThis.__observerPanelProps.model.recent.every((row) => !/이전 경기 제작|교체 기록/.test(row.text)));
  console.log(JSON.stringify({ scope: 'synthetic MainStage hook lifecycle', builderCalls: beforeBuilds(), measuredCallbacks: counts(), frames: 20 }));
  console.log('OBSERVER_EVENT_WINDOW_UI 6/6');
} finally {
  stopProbe();
  harness.unmount();
  delete globalThis.__observerPanelProps;
}
