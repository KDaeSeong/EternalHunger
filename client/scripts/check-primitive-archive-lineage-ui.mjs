import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import nextImageModule from 'next/image.js';
import postcss from 'postcss';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';

const root = new URL('../', import.meta.url);
const componentUrl = new URL('src/app/games/primitive-archive/_components/PrimitiveArchiveFoundersTab.js', root).href;
const portraitUrl = new URL('src/app/games/primitive-archive/_components/PrimitiveArchivePortrait.js', root).href;
globalThis.__lineageUiReact = React;
globalThis.__lineageUiImage = nextImageModule.default;
const hooksSource = `
  export function useState(initial) {
    const harness = globalThis.__lineageUiHooks;
    if (!harness) return globalThis.__lineageUiReact.useState(initial);
    const index = harness.cursor++;
    if (!(index in harness.values)) harness.values[index] = typeof initial === 'function' ? initial() : initial;
    return [harness.values[index], value => {
      harness.values[index] = typeof value === 'function' ? value(harness.values[index]) : value;
    }];
  }
  export function useRef(initial) {
    const harness = globalThis.__lineageUiHooks;
    if (!harness) return globalThis.__lineageUiReact.useRef(initial);
    const index = harness.cursor++;
    if (!(index in harness.values)) harness.values[index] = { current: initial };
    return harness.values[index];
  }
`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === componentUrl && specifier === 'react') {
      return { url: `data:text/javascript,${encodeURIComponent(hooksSource)}`, shortCircuit: true };
    }
    if (context.parentURL === portraitUrl && specifier === 'next/image') {
      return { url: 'data:text/javascript,export default globalThis.__lineageUiImage;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url !== componentUrl && url !== portraitUrl) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Founders } = await import(componentUrl);
const engine = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { founderHistoryRows } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveFounders.js');
const life = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveLineage.js');
const faith = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveAncestralFaith.js');
const copy = (value) => JSON.parse(JSON.stringify(value));
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
const initial = engine.createNewState({ runId: 'lineage-ui-fixture', now: '2026-10-30T00:00:00.000Z', rng: () => 0.5 });
const ready = { ...initial, day: 15, ap: 4,
  camp: { ...initial.camp, shelterLevel: 1, fireLevel: 1, fuel: 4 },
  inventory: { ...initial.inventory, berry: 30 },
  tribe: { ...initial.tribe, population: 4, morale: 60 },
  research: { ...initial.research, completed: { ...initial.research.completed, SETTLEMENT: true, FOOD_STORAGE: true } },
  lineage: life.createLineage(initial),
};
ready.lineage.communityStartedDay = 1;
ready.lineage.members[0].cycle = 12;
ready.lineage.members[0].stage = 'elder';
ready.founderHistory.members[0].tallies = { gather: 3 };
ready.founderHistory.members[1].tallies = { research_contribution: 3 };
ready.founderHistory.members[2].tallies = { recovery: 3 };
ready.ancestralFaith = faith.createAncestralFaith(ready);
const firstId = ready.party[0].id;
const firstName = ready.party[0].name;
const preparedResult = life.prepareLineageSuccessor(ready, firstId);
assert.equal(preparedResult.ok, true);
const prepared = preparedResult.state;
const retiredResult = life.retireLineageActor(prepared, firstId);
assert.equal(retiredResult.ok, true);
const retired = retiredResult.state;
const deceased = copy(retired);
deceased.day = 25;
const prior = deceased.lineage.members.find((row) => row.actorId === firstId);
prior.stage = 'deceased'; prior.cycle = 24;
prior.deathRecord = { day: 25, source: 'natural', reason: '게임 생애주기 종료', hpBefore: 100,
  damage: 0, hungerDamage: 0, coldDamage: 0, hypothermiaDamage: 0 };
prior.retiredSnapshot.hp = 0;
prior.retiredSnapshot.deathRecord = prior.deathRecord;
freeze(ready); freeze(prepared); freeze(retired); freeze(deceased);
const calls = { prepare: [], retire: [], rite: [] };
const propsFor = (state) => ({ state, foundersRows: founderHistoryRows(state), lineage: life.lineageSummary(state),
  ancestralRows: faith.ancestralFaithRows(state, state.party.find((actor) => actor.hp > 0)?.id),
  ancestralFaith: faith.ancestralFaithSummary(state),
  prepareSuccessor: (id) => calls.prepare.push(id), retireFounder: (id) => calls.retire.push(id),
  runAncestralRite: (id) => calls.rite.push(id), busy: false });
const render = (props) => renderToStaticMarkup(React.createElement(Founders, props));
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap((child) => nodes(child, predicate))];
};
const button = (tree, label) => nodes(tree, (node) => node.type === 'button' && node.props['aria-label'] === label)[0];
const createHarness = () => {
  const hooks = { cursor: 0, values: [] };
  return (props) => {
    hooks.cursor = 0; globalThis.__lineageUiHooks = hooks;
    try { return Founders(props); } finally { delete globalThis.__lineageUiHooks; }
  };
};
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log(`PASS ${name}`); };

check('actual getters render game activity cycles, practical decisions and collapsed historical records', () => {
  const props = propsFor(prepared);
  const html = render(props);
  assert.match(html, /게임상 활동기 12기/);
  assert.match(html, /원작 캐릭터의 나이가 아닙니다/);
  assert.match(html, /후계 인계 예고/);
  assert.ok(html.indexOf('생애와 후계') < html.indexOf('이름·분야별 업적·최근 기록'));
  assert.match(html, /<details class="games-panel primitive-founders__archive">/);
  assert.ok(html.includes(props.lineage.prepareCostText));
  assert.ok(html.includes(props.lineage.retireCostText));
  assert.ok(!html.includes('window.confirm'));
  assert.ok(!html.includes('아직 제공하지 않습니다'));
});
check('retired living people remain teachers and only confirmed deceased founders become ancestral gods', () => {
  const livingHtml = render(propsFor(retired));
  assert.match(livingHtml, /은퇴·생존/);
  assert.match(livingHtml, /은퇴한 인물의 가르침/);
  assert.ok(!livingHtml.includes('사후 시조신의 가호'));
  const deadHtml = render(propsFor(deceased));
  assert.match(deadHtml, /사후 시조신의 가호/);
  assert.ok(deadHtml.includes(firstName));
  assert.match(deadHtml, /기여 3회/);
});
check('actual preparation handler sends the exact actor and all controls obey the persistence lock', () => {
  const interact = createHarness();
  const before = JSON.stringify(ready);
  button(interact(propsFor(ready)), `${firstName}의 후계 준비`).props.onClick();
  assert.deepEqual(calls.prepare, [firstId]);
  const locked = interact({ ...propsFor(ready), busy: 'save' });
  const lockedButton = button(locked, `${firstName}의 후계 준비`);
  assert.equal(lockedButton.props.disabled, true);
  lockedButton.props.onClick();
  assert.deepEqual(calls.prepare, [firstId]);
  assert.equal(JSON.stringify(ready), before);
});
check('retirement requires the real inline confirmation, names the replacement and supports focus-restoring cancel', () => {
  const interact = createHarness();
  const props = propsFor(prepared);
  let tree = interact(props);
  const start = button(tree, `${firstName}의 은퇴 인계`);
  let focused = 0;
  start.props.ref({ focus: () => { focused += 1; } });
  start.props.onClick();
  assert.equal(calls.retire.length, 0);
  tree = interact(props);
  const group = nodes(tree, (node) => node.props?.role === 'group')[0];
  assert.ok(group);
  const confirmationHtml = renderToStaticMarkup(group);
  assert.ok(confirmationHtml.includes(firstName));
  assert.ok(confirmationHtml.includes(props.lineage.rows[0].successorName));
  assert.match(confirmationHtml, /장비는 후계에게 한 번 이전/);
  assert.match(confirmationHtml, /은퇴는 신격화나 사망이 아닙니다/);
  assert.ok(group.props['aria-labelledby']);
  button(tree, `${firstName}의 은퇴 취소`).props.onClick();
  assert.equal(focused, 1);
  assert.equal(nodes(interact(props), (node) => node.props?.role === 'group').length, 0);
  assert.equal(calls.retire.length, 0);
  button(interact(props), `${firstName}의 은퇴 인계`).props.onClick();
  tree = interact(props);
  button(tree, `${firstName}의 은퇴·인계 확정`).props.onClick();
  assert.deepEqual(calls.retire, [firstId]);
  assert.equal(nodes(interact(props), (node) => node.props?.role === 'group').length, 0);
});
check('changed actor cycle, successor, run or day invalidates an open retirement confirmation', () => {
  for (const change of ['cycle', 'successor', 'run', 'day']) {
    const interact = createHarness();
    const props = propsFor(prepared);
    button(interact(props), `${firstName}의 은퇴 인계`).props.onClick();
    const changed = { ...props, state: { ...props.state }, lineage: copy(props.lineage) };
    if (change === 'cycle') changed.lineage.rows[0].cycle += 1;
    if (change === 'successor') changed.lineage.rows[0].successorId += '-different';
    if (change === 'run') changed.state.runId += '-different';
    if (change === 'day') changed.state.day += 1;
    assert.equal(nodes(interact(changed), (node) => node.props?.role === 'group').length, 0);
  }
  assert.deepEqual(calls.retire, [firstId]);
});
check('cancelled, superseded and already-confirmed retirement handlers cannot retire or cancel a newer target', () => {
  const secondId = ready.party[1].id;
  const secondName = ready.party[1].name;
  const secondPrepared = life.prepareLineageSuccessor(prepared, secondId);
  assert.equal(secondPrepared.ok, true);
  const retiredIds = [];
  const props = { ...propsFor(secondPrepared.state), retireFounder: (id) => retiredIds.push(id) };
  const interact = createHarness();
  const startA = () => button(interact(props), `${firstName}의 은퇴 인계`).props.onClick();
  startA();
  let tree = interact(props);
  const cancelledConfirm = button(tree, `${firstName}의 은퇴·인계 확정`).props.onClick;
  const cancelledCancel = button(tree, `${firstName}의 은퇴 취소`).props.onClick;
  cancelledCancel();
  cancelledConfirm();
  assert.deepEqual(retiredIds, []);
  startA();
  tree = interact(props);
  const replacedSamePersonConfirm = button(tree, `${firstName}의 은퇴·인계 확정`).props.onClick;
  startA();
  replacedSamePersonConfirm();
  assert.deepEqual(retiredIds, [], 'Reopening the same person must create a fresh confirmation token.');
  tree = interact(props);
  const supersededConfirm = button(tree, `${firstName}의 은퇴·인계 확정`).props.onClick;
  const supersededCancel = button(tree, `${firstName}의 은퇴 취소`).props.onClick;
  button(tree, `${secondName}의 은퇴 인계`).props.onClick();
  supersededConfirm(); supersededCancel(); cancelledCancel();
  tree = interact(props);
  assert.deepEqual(retiredIds, []);
  assert.equal(nodes(tree, (node) => node.props?.role === 'group').length, 1);
  const currentConfirm = button(tree, `${secondName}의 은퇴·인계 확정`);
  assert.ok(currentConfirm, 'Stale cancellation must leave the newer person confirmation open.');
  currentConfirm.props.onClick(); currentConfirm.props.onClick(); supersededConfirm();
  assert.deepEqual(retiredIds, [secondId], 'Even before another render, confirmation must apply only once.');
  assert.equal(nodes(interact(props), (node) => node.props?.role === 'group').length, 0);
});
check('faith controls use real readiness and founder identities with no extra callback while locked', () => {
  const interact = createHarness();
  const props = propsFor(retired);
  const teacher = props.ancestralRows.find((row) => row.founderId === firstId);
  assert.equal(teacher.ready, true);
  button(interact(props), `${firstName}의 가르침 받기`).props.onClick();
  assert.deepEqual(calls.rite, [firstId]);
  const locked = button(interact({ ...props, busy: true }), `${firstName}의 가르침 받기`);
  assert.equal(locked.props.disabled, true); locked.props.onClick();
  assert.deepEqual(calls.rite, [firstId]);
  const noFood = copy(retired); noFood.inventory.berry = 0;
  const noFoodProps = propsFor(noFood);
  const noFoodButton = button(interact(noFoodProps), `${firstName}의 가르침 받기`);
  assert.equal(noFoodButton.props.disabled, true); noFoodButton.props.onClick();
  assert.deepEqual(calls.rite, [firstId]);
  assert.match(render(noFoodProps), /실제 비축 베리 1개가 필요합니다/);
  const deceasedProps = propsFor(deceased);
  button(interact(deceasedProps), `${firstName}의 가호 의례`).props.onClick();
  assert.deepEqual(calls.rite, [firstId, firstId]);
});
check('active effects display exact getter output and remaining uses for chance, study and care domains', () => {
  for (const founder of ready.founderHistory.members) {
    const result = faith.runAncestralRite(ready, { actorId: firstId, founderId: founder.actorId });
    assert.equal(result.ok, true);
    const props = propsFor(result.state);
    const html = render(props);
    const activeText = html.match(/class="primitive-founders__active"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '';
    assert.ok(activeText.includes(props.ancestralFaith.activeEffectText));
    assert.ok(activeText.includes(founder.name));
    assert.match(activeText, /오늘 2회 남음/);
    if (['study', 'care'].includes(props.ancestralFaith.active.domain)) assert.ok(!activeText.includes('+15%p'));
  }
});
check('legacy states stay disabled and all display/action paths leave source state unchanged', () => {
  const legacy = copy(ready); delete legacy.lineage; delete legacy.ancestralFaith; delete legacy.projectTradition;
  const before = JSON.stringify(legacy);
  const props = propsFor(legacy);
  const html = render(props);
  assert.match(html, /이전 런의 생애 전환은 비활성/);
  assert.match(html, /이전 런에서는 조상신 효과를 새로 활성화하지 않습니다/);
  const tree = createHarness()(props);
  for (const node of nodes(tree, (element) => element.type === 'button')) {
    assert.equal(node.props.disabled, true);
    node.props.onClick();
  }
  assert.equal(JSON.stringify(legacy), before);
  assert.deepEqual(calls.prepare, [firstId]); assert.deepEqual(calls.retire, [firstId]);
  assert.deepEqual(calls.rite, [firstId, firstId]);
});
check('lineage stylesheet keeps compact wrapping and keyboard focus without replacing founder selection styles', () => {
  const css = readFileSync(new URL('src/styles/PrimitiveArchiveFounders.css', root), 'utf8');
  const parsed = postcss.parse(css);
  const media = []; parsed.walkAtRules('media', (rule) => media.push(rule.params));
  assert.ok(media.includes('(max-width: 480px)'));
  assert.match(css, /primitive-founders__life-head[\s\S]*flex-wrap: wrap/);
  assert.match(css, /primitive-founders button:focus-visible/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /primitive-founder-selection__choices/);
});
delete globalThis.__lineageUiReact; delete globalThis.__lineageUiImage;
console.log(JSON.stringify({ pass: true, checks,
  scope: 'Actual component SSR/Next Image and real getter fixtures; component event handlers with deterministic useState/useRef harness. Not browser layout, live game, persistence or complete lifecycle integration acceptance.' }));
