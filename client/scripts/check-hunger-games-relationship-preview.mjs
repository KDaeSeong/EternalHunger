import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import ts from 'typescript';
import { normalizeHungerEvent } from '../src/app/hungergames/_lib/hungerGameContract.js';
import { createHungerDraft, DEFAULT_HUNGER_EVENTS } from '../src/app/hungergames/_lib/hungerGamePresets.js';
import { createHungerPreview } from '../src/app/hungergames/_lib/hungerGamePreview.js';
import { createHungerRun, inspectHungerEvent, resolveHungerEvent } from '../src/app/hungergames/_lib/hungerGameRuntime.js';
import { createHungerPack } from '../src/app/hungergames/_lib/hungerGamePersistence.js';

const betrayal = DEFAULT_HUNGER_EVENTS.find(event => event.id === 'betrayal');
const roster = ['a', 'b', 'c', 'd'].map(id => ({ id, name: '참가자 ' + id, hungerTraits: [], items: [] }));
const context = { day: 2, phase: 'day', weather: 'clear', location: 'camp' };
const input = { roster, event: betrayal, matchMode: 'solo', context, casting: { attacker: 'a', victim: 'b' } };
const relation = kind => [{ left: 'attacker', right: 'victim', kind }];
let checks = 0;
const check = (name, run) => { run(); checks += 1; console.log('PASS ' + name); };

check('absent and explicit no-relationship context retain the original preview and reject alliance-only betrayal', () => {
  const before = createHungerPreview(input), empty = createHungerPreview({ ...input, relationships: relation('none') });
  assert.deepEqual(empty, before); assert.deepEqual(before.state.relationships, []);
  assert.equal(inspectHungerEvent(before.state, betrayal, before.assigned).eligible, false);
});
check('alliance context enables real betrayal while preserving day and team restrictions', () => {
  const result = createHungerPreview({ ...input, relationships: relation('ally') });
  assert.deepEqual(result.state.relationships, [{ leftId: 'a', rightId: 'b', kind: 'ally' }]);
  assert.equal(inspectHungerEvent(result.state, betrayal, result.assigned).eligible, true);
  assert.ok(resolveHungerEvent(result.state, betrayal, result.assigned).row);
  const early = createHungerPreview({ ...input, context: { ...context, day: 1 }, relationships: relation('ally') });
  assert.equal(inspectHungerEvent(early.state, betrayal, early.assigned).eligible, false);
  const team = createHungerPreview({ ...input, matchMode: 'team', roster: roster.map(actor => ({ ...actor, teamId: 'same' })), relationships: relation('ally') });
  assert.equal(inspectHungerEvent(team.state, betrayal, team.assigned).eligible, false);
});
check('enemy-only authored events require actual selected actor pairs and support reversed role order', () => {
  const event = normalizeHungerEvent({ ...createHungerDraft('enemy-preview'), roles: betrayal.roles,
    relations: [{ left: 'attacker', right: 'victim', kind: 'enemy' }], outcomes: [{ text: '{attacker}은 {victim}을 경계한다.' }] });
  const empty = createHungerPreview({ ...input, event });
  assert.equal(inspectHungerEvent(empty.state, event, empty.assigned).eligible, false);
  const enemy = createHungerPreview({ ...input, event, casting: { attacker: 'c', victim: 'a' }, relationships: [{ left: 'victim', right: 'attacker', kind: 'enemy' }] });
  assert.equal(inspectHungerEvent(enemy.state, event, enemy.assigned).eligible, true);
  assert.deepEqual(enemy.state.relationships, [{ leftId: 'a', rightId: 'c', kind: 'enemy' }]);
});
check('the four new standard relationship stories accept only their chosen alliance or enemy preview context', () => {
  for (const id of ['ally-supply-support', 'ally-supply-dispute', 'enemy-reencounter', 'enemy-food-reconciliation']) {
    const event = DEFAULT_HUNGER_EVENTS.find(row => row.id === id); assert.ok(event, id);
    const kind = event.relations.find(row => ['ally', 'enemy'].includes(row.kind)).kind;
    const actors = roster.map((actor, index) => index === 0 ? { ...actor, items: ['식량'] } : actor);
    const args = { roster: actors, event, matchMode: 'solo', context };
    const empty = createHungerPreview(args);
    assert.equal(inspectHungerEvent(empty.state, event, empty.assigned).eligible, false, id);
    const preview = createHungerPreview({ ...args, relationships: [{ left: event.roles[0].key, right: event.roles[1].key, kind }] });
    assert.equal(inspectHungerEvent(preview.state, event, preview.assigned).eligible, true, id);
    assert.ok(resolveHungerEvent(preview.state, event, preview.assigned).row, id);
  }
});
check('duplicate actors, invalid or obsolete roles, self pairs, duplicate pairs and unknown relationships fail closed', () => {
  assert.throws(() => createHungerPreview({ ...input, casting: { attacker: 'a', victim: 'a' } }), /서로 다른 참가자/);
  assert.throws(() => createHungerPreview({ ...input, casting: { attacker: 'missing', victim: 'a' } }), /배정할 참가자/);
  for (const relationships of [null, {}, [{ left: 'obsolete', right: 'victim', kind: 'ally' }],
    [{ left: 'attacker', right: 'attacker', kind: 'ally' }], relation('unknown'),
    [...relation('ally'), { left: 'victim', right: 'attacker', kind: 'enemy' }], Array(7).fill(relation('ally')[0])]) {
    assert.throws(() => createHungerPreview({ ...input, relationships }), /시험 관계|배역 쌍/);
  }
});
check('all six four-role pairs remain independent and no preview context enters live input, pack or global RNG', () => {
  const roles = ['one', 'two', 'three', 'four'].map(key => ({ key }));
  const event = normalizeHungerEvent({ ...createHungerDraft('four-preview'), roles, outcomes: [{ text: '{one}은 기다린다.' }] });
  const relationships = roles.flatMap((left, index) => roles.slice(index + 1).map(right => ({ left: left.key, right: right.key, kind: 'ally' })));
  const config = { roster, events: [event], seed: 'live-input', maxPhases: 3 }, run = createHungerRun(config);
  const before = JSON.stringify({ config, run, relationships }), random = Math.random;
  try {
    Math.random = () => { throw Error('Preview must not consume global randomness'); };
    const preview = createHungerPreview({ roster, event, context, relationships });
    assert.equal(preview.state.relationships.length, 6);
    assert.ok(!Object.hasOwn(preview.state.input, 'relationships'));
    resolveHungerEvent(preview.state, event, preview.assigned);
    const pack = createHungerPack(config, run);
    assert.ok(!JSON.stringify(pack).includes('leftId'));
    assert.deepEqual(createHungerPack(config, preview.state).run.phases, 0);
    assert.equal(JSON.stringify({ config, run, relationships }), before);
  } finally { Math.random = random; }
});

const editorUrl = new URL('../src/app/hungergames/_components/HungerEventEditor.js', import.meta.url).href;
const hookSource = `
export function useState(initial){const h=globalThis.__hgRelationPreview;const i=h.cursor++;if(!(i in h.cells))h.cells[i]=typeof initial==='function'?initial():initial;return[h.cells[i],v=>{h.cells[i]=typeof v==='function'?v(h.cells[i]):v;}];}
export function useRef(initial){const h=globalThis.__hgRelationPreview;const i=h.cursor++;if(!(i in h.cells))h.cells[i]={current:initial};return h.cells[i];}
export function useLayoutEffect(setup){const h=globalThis.__hgRelationPreview;const i=h.cursor++;h.cleanups[i]?.();h.cleanups[i]=setup();}`;
registerHooks({
  resolve(specifier, parent, next) {
    if (parent.parentURL === editorUrl) {
      if (specifier === 'react') return { url: 'data:text/javascript,' + encodeURIComponent(hookSource), shortCircuit: true };
      if (specifier.endsWith('/HungerTraitFields')) return { url: 'data:text/javascript,export default function Boundary(){return null}', shortCircuit: true };
      if (specifier.endsWith('.module.css')) return { url: 'data:text/javascript,' + encodeURIComponent('export default new Proxy({},{get:(_,key)=>String(key)});'), shortCircuit: true };
    }
    return next(specifier, parent);
  },
  load(url, parent, next) {
    if (url !== editorUrl) return next(url, parent);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Editor } = await import(editorUrl);
const nodes = (node, predicate) => !node || typeof node !== 'object' ? []
  : [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const mount = () => {
  const workspace = { events: [structuredClone(betrayal), createHungerDraft('other-preview')], roster: structuredClone(roster), draft: null, origin: null, ready: true, busy: false, notices: [] };
  const h = { cells: [], cleanups: [], cursor: 0, workspace };
  h.render = () => {
    h.cursor = 0; globalThis.__hgRelationPreview = h;
    h.tree = Editor({ ...workspace, draftOriginId: workspace.origin, matchMode: 'solo',
      onChange: events => { workspace.events = events; }, onDraftChange: draft => { workspace.draft = draft; },
      onDraftOriginIdChange: origin => { workspace.origin = origin; }, onNotice: notice => workspace.notices.push(notice), onPresetsReset: () => true });
    return h.tree;
  };
  h.button = label => nodes(h.tree, node => node.type === 'button').find(node => textOf(node) === label
    || (node.props['aria-pressed'] !== undefined && textOf(node).replace(/^[●○] /, '').startsWith(label)));
  h.click = label => { const button = h.button(label); assert.ok(button, label); button.props.onClick(); h.render(); };
  h.relation = () => nodes(h.tree, node => node.props?.['aria-label'] === '시험 관계 attacker victim')[0];
  h.setRelation = kind => { h.relation().props.onChange(kind); h.render(); };
  h.unmount = () => h.cleanups.forEach(cleanup => cleanup?.());
  h.render(); return h;
};
const previousWindow = globalThis.window;
globalThis.window = { confirm: () => true };
try {
  check('actual editor runs alliance-only preview and displays selected actor names without changing events', () => {
    const h = mount(), before = JSON.stringify(h.workspace.events);
    const day = nodes(h.tree, node => node.type === 'label' && textOf(node).startsWith('일차'))[0];
    nodes(day, node => node.type === 'input')[0].props.onChange({ target: { value: '2' } }); h.render();
    h.setRelation('ally'); h.click('시험 판정');
    assert.ok(textOf(h.tree).includes('가능한 분기:')); assert.ok(textOf(h.tree).includes('참가자 a (공격자)') || textOf(h.tree).includes('참가자 a'));
    assert.equal(JSON.stringify(h.workspace.events), before); assert.equal(h.workspace.draft, null); h.unmount();
  });
  check('participant reassignment clears old relationship context and duplicate casting reports a specific error', () => {
    const h = mount(); h.setRelation('ally');
    const selects = nodes(h.tree, node => node.props?.options?.some(option => option.value === 'a'));
    selects[1].props.onChange('a'); h.render();
    assert.equal(h.relation().props.value, 'none'); assert.equal(h.relation().props.disabled, true);
    h.click('시험 판정'); assert.ok(textOf(h.tree).includes('서로 다른 참가자')); h.unmount();
  });
  check('selection addition duplication deletion and preset reset clear relationship setup', () => {
    for (const action of ['새 이벤트', '추가', '새 ID로 복제', '삭제', '기본 사건 업데이트']) {
      const h = mount(); h.setRelation('enemy');
      h.click(action);
      assert.ok(!h.relation() || h.relation().props.value === 'none'); h.unmount();
    }
  });
  check('JSON role changes and role deletion cannot retain obsolete preview pairs', () => {
    const h = mount(); h.setRelation('ally');
    const replacement = normalizeHungerEvent({ ...createHungerDraft('json-pair'), roles: [{ key: 'attacker' }, { key: 'victim' }, { key: 'extra' }], outcomes: [{ text: '{attacker}은 기다린다.' }] });
    const textarea = nodes(h.tree, node => node.props?.['aria-label'] === '이벤트 JSON')[0];
    textarea.props.onChange({ target: { value: JSON.stringify(replacement) } }); h.render(); h.click('편집기에 적용');
    assert.equal(h.relation().props.value, 'none'); h.setRelation('enemy');
    const removals = nodes(h.tree, node => node.type === 'button' && textOf(node) === '역할 삭제');
    removals[2].props.onClick(); h.render(); assert.equal(h.relation().props.value, 'none'); h.unmount();
  });
  check('busy not-ready stale-render and unmounted relationship handlers remain inert', () => {
    const h = mount(), old = h.relation(); h.render(); old.props.onChange('ally'); h.render();
    assert.equal(h.relation().props.value, 'none');
    for (const locked of [{ busy: true }, { busy: false, ready: false }]) {
      Object.assign(h.workspace, locked); h.render(); h.relation().props.onChange('enemy'); h.render();
      assert.equal(h.relation().props.value, 'none');
    }
    Object.assign(h.workspace, { busy: false, ready: true }); h.render(); const after = h.relation(); h.unmount();
    after.props.onChange('ally'); h.render(); assert.equal(h.relation().props.value, 'none'); h.unmount();
  });
} finally { globalThis.window = previousWindow; delete globalThis.__hgRelationPreview; }
console.log(JSON.stringify({ pass: true, checks, scope: 'Fresh preview state and actual editor handlers only; no live game, persistence, API, browser, build, rules-version or gameplay RNG changes.' }));
