import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';
import { createHungerRun, advanceHungerRun, getHungerHistoryView, resolveHungerEvent } from '../src/app/hungergames/_lib/hungerGameRuntime.js';
import { normalizeHungerEvent } from '../src/app/hungergames/_lib/hungerGameContract.js';
import { createHungerPack } from '../src/app/hungergames/_lib/hungerGamePersistence.js';
import { getHungerRelationshipView } from '../src/app/hungergames/_lib/hungerGameRelationshipView.js';

const viewerUrl = new URL('../src/app/hungergames/_components/HungerRunViewer.js', import.meta.url).href;
const cssUrl = new URL('../src/app/hungergames/HungerGames.module.css', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(context.parentURL === viewerUrl && specifier === 'next/image' ? 'next/image.js' : specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === cssUrl) return { format: 'module', shortCircuit: true, source: 'export default new Proxy({}, {get: (_,name)=>String(name)});' };
    if (url !== viewerUrl) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Viewer } = await import(viewerUrl);
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
const roles = (ids) => ids.map((key) => ({ key, allTraits: [`role_${key}`] }));
const relation = (type, target, other) => ({ type, target, other });
const event = (id, title, label, participants, effects, phase, day) => ({ id, title, phases: [phase], minDay: day, maxDay: day,
  roles: roles(participants), outcomes: [{ label, text: participants.map((key) => `{${key}}`).join(' · ') + '의 관측된 사건.', effects }] });
const config = { seed: 'relationship-view-source', maxPhases: 5,
  roster: [{ id: 'a', name: '가람', hungerTraits: ['role_a'] }, { id: 'b', name: '나래', hungerTraits: ['role_b'] },
    { id: 'c', name: '다온', hungerTraits: ['role_c', 'mechanical'] }],
  events: [
    event('network', '공동 경계', '셋의 약속', ['a', 'b', 'c'], [relation('ally', 'a', 'b'), relation('ally', 'b', 'c'), relation('ally', 'a', 'c')], 'opening', 0),
    event('repeat', '함께 경계', '동행 재확인', ['a', 'b'], [relation('ally', 'b', 'a')], 'day', 1),
    event('break', '동맹의 기습', '눈치챔', ['a', 'b'], [relation('enemy', 'a', 'b')], 'night', 1),
    event('reconcile', '공동 탈출', '동행', ['a', 'b'], [relation('ally', 'b', 'a')], 'day', 2),
    event('loss', '기계 고장', '정지', ['c'], [{ type: 'death', target: 'c', cause: 'accident' }], 'night', 2),
  ] };
const finish = (version) => { let run = createHungerRun(config, version); while (!run.finished) run = advanceHungerRun(run); return freeze(run); };
const run = finish(3);
assert.equal(run.history.length, 5);
const before = JSON.stringify(createHungerPack(config, run));
const nodes = (node, predicate) => !node || typeof node !== 'object' ? []
  : [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap((child) => nodes(child, predicate))];
const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const props = (extra = {}) => ({ run, viewIndex: -1, onViewIndex: () => {}, onFollowActor: () => {}, ...extra });
const render = (input) => renderToStaticMarkup(React.createElement(Viewer, input));
let checks = 0;
const check = (name, test) => { test(); checks += 1; console.log(`PASS ${name}`); };

check('three-person real receipts identify every pair and expose the selected outcome', () => {
  const html = render(props({ viewIndex: 0 }));
  for (const text of ['가람 · 나래 · 새 동맹', '나래 · 다온 · 새 동맹', '가람 · 다온 · 새 동맹', '결과: 셋의 약속']) assert.ok(html.includes(text));
  assert.equal(getHungerRelationshipView(run.history, 0).relationships.length, 3);
});
check('repeated symmetric effects show maintenance without replacing the last actual change evidence', () => {
  const view = getHungerRelationshipView(run.history, 1);
  const row = run.history[1].rows.find((row) => row.eventId === 'repeat');
  const change = view.effectsByRow.get(row).get(0);
  assert.equal(change.changed, false); assert.equal(change.label, '동맹 유지');
  const pair = view.relationships.find((relation) => [relation.leftId, relation.rightId].sort().join('') === 'ab');
  assert.equal(pair.lastChange.historyIndex, 0); assert.equal(pair.lastChange.title, '공동 경계');
  const html = render(props({ viewIndex: 1 })); assert.ok(html.includes('나래 · 가람 · 동맹 유지'));
  assert.ok(html.includes('마지막 변화: 시작 · 공동 경계 · 셋의 약속 · 새 동맹'));
});
check('actual alliance-to-enemy and enemy-to-alliance changes do not invent a death or motive', () => {
  const broken = render(props({ viewIndex: 2 }));
  assert.ok(broken.includes('가람 · 나래 · 동맹 → 적대')); assert.ok(broken.includes('결과: 눈치챔'));
  assert.ok(broken.includes('동맹의 기습')); assert.ok(!broken.includes('탈락자 포함 기록'));
  assert.equal(nodes(Viewer(props({ viewIndex: 2 })), (node) => node.type === 'article' && node.props.className === 'deathEvent').length, 0);
  assert.ok(render(props({ viewIndex: 3 })).includes('나래 · 가람 · 적대 → 동맹'));
  const prose = { rows: [{ id: 'prose', title: '동맹의 배신', outcome: '배신', text: '배신했다.', effects: [] }] };
  assert.equal(getHungerRelationshipView([{ ...prose, day: 1, phase: 'day' }]).relationships.length, 0);
});
check('history cutoffs hide later changes, elimination and results while follow filtering retains global relationships', () => {
  const input = props({ viewIndex: 1, followActorId: 'c' }); const html = render(input);
  for (const future of ['동맹의 기습', '공동 탈출', '기계 고장', '탈락자 포함 기록', '동맹 → 적대']) assert.ok(!html.includes(future));
  const tree = Viewer(input);
  assert.equal(nodes(tree, (node) => node.type === 'article').length, 1);
  assert.ok(html.includes('다온 등장 1건 / 전체 2건'));
  assert.ok(html.includes('전체 참가자의 표시 시점 관계입니다.'));
  assert.ok(html.includes('가람 · 동맹') || html.includes('가람</strong> · 동맹'));
  assert.equal(nodes(tree, (node) => node.props.className === 'result').length, 0);
});
check('relationship record navigation uses only observed phases and leaves follow selection untouched', () => {
  const destinations = []; const selections = [];
  const tree = Viewer(props({ followActorId: 'c', onViewIndex: (index) => destinations.push(index), onFollowActor: (id) => selections.push(id) }));
  const buttons = nodes(tree, (node) => node.type === 'button' && textOf(node) === '관계 변화 기록 보기');
  assert.equal(buttons.length, 3);
  for (const button of buttons) { assert.equal(button.props.disabled, false); button.props.onClick(); }
  assert.deepEqual(destinations.sort(), [0, 0, 3]); assert.deepEqual(selections, []);
  const current = Viewer(props({ viewIndex: 0, onViewIndex: (index) => destinations.push(index) }));
  for (const button of nodes(current, (node) => node.type === 'button' && textOf(node) === '관계 변화 기록 보기')) {
    assert.equal(button.props.disabled, true); button.props.onClick();
  }
  assert.equal(destinations.length, 3);
});
check('eliminated endpoints are identified from the viewed state without deleting historical relationships', () => {
  const html = render(props()); assert.ok(html.includes('탈락자 포함 기록'));
  assert.ok(html.includes('다온: 작동 정지')); assert.ok(html.includes('생존자 2 / 3'));
  assert.equal(getHungerRelationshipView(run.history).relationships.length, 3);
  assert.ok(!render(props({ viewIndex: 3 })).includes('다온: 작동 정지'));
});
check('same-row effects follow receipt order rather than title or text inference', () => {
  const event = normalizeHungerEvent({ id: 'ordered', title: '관계 유지라고 쓰인 제목', roles: [{ key: 'a' }, { key: 'b' }],
    outcomes: [{ label: '관측 결과', text: '아무 관계도 바뀌지 않았다고 쓰인 문장.', effects: [relation('ally', 'a', 'b'), relation('enemy', 'b', 'a')] }] });
  const initial = createHungerRun({ ...config, events: [event] });
  const result = resolveHungerEvent(initial, event, { a: 'a', b: 'b' });
  assert.ok(result.row);
  const view = getHungerRelationshipView([{ day: 0, phase: 'opening', rows: [result.row] }]);
  assert.equal(view.effectsByRow.get(result.row).get(0).label, '새 동맹');
  assert.equal(view.effectsByRow.get(result.row).get(1).label, '동맹 → 적대');
  assert.equal(view.relationships[0].kind, 'enemy');
});
check('v1/v2/v3 derived relations match actual historical state without mutations or gameplay randomness', () => {
  for (const version of [1, 2, 3]) {
    const fixture = finish(version); const original = JSON.stringify(fixture);
    for (let index = 0; index < fixture.history.length; index += 1) {
      const expected = getHungerHistoryView(fixture, index).relationships;
      const derived = getHungerRelationshipView(fixture.history, index).relationships.map(({ leftId, rightId, kind }) => ({ leftId, rightId, kind }));
      assert.deepEqual(derived, expected);
    }
    assert.equal(JSON.stringify(fixture), original);
  }
  const random = Math.random;
  try { Math.random = () => { throw Error('Observer must not draw gameplay randomness'); }; render(props({ followActorId: 'a' })); }
  finally { Math.random = random; }
  assert.equal(JSON.stringify(createHungerPack(config, run)), before);
  postcss.parse(readFileSync(new URL(cssUrl), 'utf8'));
});
console.log(JSON.stringify({ pass: true, checks,
  scope: 'Actual viewer SSR and handlers with fresh deterministic engine receipts; ordered relationship projection and v1/v2/v3 historical parity. No browser layout, engine edits, save/RNG changes, build or full HG regression.' }));
