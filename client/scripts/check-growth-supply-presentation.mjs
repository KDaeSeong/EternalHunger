import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { presentGrowthSupplyNote } from '../src/app/simulation/_components/simulationGrowthSupplyPresentation.js';

const { buildActorGrowthPlan } = await import('../src/app/simulation/_lib/growthPlanRuntime.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { createFieldResources } = await import('../src/app/simulation/_lib/fieldResourceRuntime.js');
const { captureMovementObjective } = await import('../src/app/simulation/_lib/movementObjectiveRuntime.js');
const { getRuleset } = await import('../src/utils/rulesets.js');
const { withSimulationRandom } = await import('../src/utils/simulationRandom.js');
const { createSimulationRunInput, validateSimulationRunInput } = await import('../src/app/simulation/_lib/simulationReplayRuntime.js');
const panelUrl = new URL('../src/app/simulation/_components/SimulationTeamObserverPanel.js', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url !== panelUrl) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: Panel } = await import(panelUrl);
const legacy = '필드 공급처 없음 · 다른 조달 판단 필요';
const scoped = '일반 필드 파밍 공급처 없음 · 자연 자원·거래 경로는 별도 판단';
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixture = ({ withIssue = false } = {}) => {
  const base = { _id: 'base', itemKey: 'base', name: '기본 모자', type: '방어구', category: 'equipment', equipSlot: 'head', tier: 1, stats: { defense: 1 } };
  const tree = { _id: 'tree', itemKey: 'tree', name: '생명의 나무', type: '재료', tier: 4 };
  const target = { ...base, _id: 'goal', itemKey: 'goal', name: '생명 모자', tier: 4,
    recipe: { ingredients: [{ itemId: 'base', qty: 1 }, { itemId: 'tree', qty: 1 }], resultQty: 1, creditsCost: 3 } };
  const items = [base, tree, target], ruleset = getRuleset('ER_S11');
  const map = { _id: 'view-only-supply-fixture', name: '표시 검증 지도', zones: [{ zoneId: 'a', name: '공장' }, { zoneId: 'b', name: '숲' }] };
  const spawnState = { coreNodes: [{ id: 'tree-source', kind: 'life_tree', zoneId: 'b', picked: false }],
    fieldResources: createFieldResources(map, items, ruleset) };
  const actor = { _id: 'observer-actor', name: '관전 대상', teamId: 'team:1', teamSlot: 1, zoneId: 'a', hp: 100, maxHp: 100, simCredits: 20,
    inventory: [{ ...base, itemId: 'base', qty: 1 }], equipped: { head: 'base' },
    goalLoadouts: { hero: { headKey: 'goal', ...(withIssue ? { armKey: 'missing-arm' } : {}) } } };
  actor._growthPlan = buildActorGrowthPlan(actor, items, { mapObj: map, nextSpawn: spawnState, zoneGraph: { a: ['b'], b: ['a'] }, ruleset });
  actor._movementObjective = { ...captureMovementObjective({ objectiveType: 'natural_core', objectiveSubkind: 'life_tree' }, 'b',
    { spawnState, ruleset, publicItems: items }), atSec: 500 };
  const companion = { _id: 'companion', name: '동료', teamId: 'team:1', teamSlot: 2, zoneId: 'a', hp: 100, maxHp: 100, inventory: [], equipped: {} };
  return { survivors: [actor, companion], dead: [], events: [], publicItems: items, spawnState,
    teamId: 'team:1', matchSec: 500, settings: { rulesetId: 'ER_S11' }, map, day: 3, phase: 'morning' };
};
const render = (model, isGameOver = false) => renderToStaticMarkup(React.createElement(Panel, { model, isGameOver, onTeamChange: () => {} }));
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log('PASS ' + name); };

check('the compatibility adapter changes only the legacy supply prefix and preserves appended issue text', () => {
  const warning = '초반 목표 확인 필요: 팔 · 아이템 목록에서 찾을 수 없음';
  assert.equal(presentGrowthSupplyNote(legacy), scoped);
  assert.equal(presentGrowthSupplyNote(legacy + ' · ' + warning), scoped + ' · ' + warning);
  for (const note of ['', null, undefined, warning, '안전한 재료 경로 없음', '계획한 재료 지역이 금지구역 · 새 판단 대기',
    '재료 확보 · 제작 비용 대기', '계획한 지역의 필요한 재료 소진 · 새 판단 대기', '가방 공간 부족 · 다른 목표 재검토',
    '인용: ' + legacy, legacy + '라는 별도 설명']) assert.equal(presentGrowthSupplyNote(note), note);
});

check('a fresh real model and actual panel show ordinary field scarcity beside an available life-tree card', () => {
  const snapshot = fixture(), before = digest(snapshot), model = buildTeamObserverModel(snapshot);
  assert.equal(snapshot.survivors[0]._growthPlan.blocked, 'no_material_source');
  assert.equal(model.members[0].growth.note, legacy);
  assert.equal(model.objectives.length, 1); assert.equal(model.objectives[0].objective.type, 'natural_core');
  assert.deepEqual(model.objectives[0].objective.sourceIds, ['tree-source']);
  assert.equal(snapshot.spawnState.coreNodes[0].picked, false);
  freeze(model); const html = render(model);
  assert.ok(html.includes(scoped)); assert.ok(html.includes('생명의 나무 확보')); assert.ok(html.includes('현재 자원 목표'));
  assert.ok(html.includes('목표는 획득 성공을 뜻하지 않습니다.')); assert.ok(!html.includes('제작 완료'));
  assert.equal(model.members[0].growth.note, legacy); assert.equal(digest(snapshot), before);
});

check('the real model issue suffix survives the scoped display without being softened or removed', () => {
  const snapshot = fixture({ withIssue: true }), model = buildTeamObserverModel(snapshot);
  const note = model.members[0].growth.note;
  assert.ok(note.startsWith(legacy + ' · ')); assert.ok(note.includes('초반 목표 확인 필요: 팔 · 아이템 목록에서 찾을 수 없음'));
  const html = render(freeze(model));
  assert.ok(html.includes(scoped)); assert.ok(html.includes(note.slice(legacy.length)));
  assert.equal(model.members[0].growth.note, note);
});

check('source lifecycle and final-state card visibility stay under the existing model and panel rules', () => {
  const active = fixture(), picked = structuredClone(active); picked.spawnState.coreNodes[0].picked = true;
  const pickedModel = buildTeamObserverModel(picked); assert.equal(pickedModel.objectives.length, 0);
  assert.ok(!render(pickedModel).includes('aria-label="현재 자원 목표"'));
  const activeModel = buildTeamObserverModel(active);
  assert.ok(!render(activeModel, true).includes('aria-label="현재 자원 목표"'));
});

check('fresh replay input and frozen model snapshots remain unchanged with both simulation and global RNG forbidden', () => {
  const snapshot = fixture(), input = createSimulationRunInput({ ...snapshot, activeMap: snapshot.map, runSeed: 'view-supply-seed' }, null);
  freeze(snapshot); freeze(input);
  const snapshotBefore = digest(snapshot), inputBefore = digest(input), globalRandom = Math.random;
  try {
    Math.random = () => { throw Error('Presentation cannot consume global RNG'); };
    withSimulationRandom(() => { throw Error('Presentation cannot consume simulation RNG'); }, () => {
      const model = freeze(buildTeamObserverModel(snapshot)), modelBefore = digest(model);
      render(model); render(model); assert.equal(digest(model), modelBefore);
    });
  } finally { Math.random = globalRandom; }
  assert.equal(digest(snapshot), snapshotBefore); assert.equal(digest(input), inputBefore);
  assert.doesNotThrow(() => validateSimulationRunInput(input));
});

console.log(JSON.stringify({ pass: true, checks, scope: 'View-only compatibility adapter and actual observer model/panel SSR with fresh controlled catalogue/world/replay inputs. No old result inputs, gameplay change, reward assertion, full match, browser or performance acceptance.' }));
