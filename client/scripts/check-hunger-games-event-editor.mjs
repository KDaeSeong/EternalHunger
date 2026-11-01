import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createHungerDraft } from '../src/app/hungergames/_lib/hungerGamePresets.js';
import { normalizeHungerConfig, normalizeHungerEvent } from '../src/app/hungergames/_lib/hungerGameContract.js';
import { createHungerRun } from '../src/app/hungergames/_lib/hungerGameRuntime.js';
import { copyHungerEventDraft } from '../src/app/hungergames/_lib/hungerGameEventEditor.js';

const root = new URL('../', import.meta.url);
const editorUrl = new URL('src/app/hungergames/_components/HungerEventEditor.js', root).href;
const traitsUrl = new URL('src/components/HungerTraitFields.js', root).href;
const cssUrl = new URL('src/app/hungergames/HungerGames.module.css', root).href;
const hookModule = `
  export function useState(initial) {
    const h = globalThis.__hungerEventEditorHarness; const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[index], value => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  }
  export function useRef(initial) {
    const h = globalThis.__hungerEventEditorHarness; const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = { current: initial };
    return h.slots[index];
  }
  export function useLayoutEffect(setup) {
    const h = globalThis.__hungerEventEditorHarness; const index = h.cursor++;
    h.cleanups[index]?.(); h.cleanups[index] = setup();
  }
`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === editorUrl && specifier === 'react') return {
      url: 'data:text/javascript,' + encodeURIComponent(hookModule), shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === cssUrl) return { format: 'module', shortCircuit: true,
      source: 'export default new Proxy({}, {get: (_, name) => String(name)});' };
    if (![editorUrl, traitsUrl].includes(url)) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Editor } = await import(editorUrl);
const clone = value => structuredClone(value);
const nodes = (node, predicate) => !node || typeof node !== 'object' ? []
  : [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
};
function workspace(count = 2) {
  const config = normalizeHungerConfig({ roster: [{ id: 'a', name: '참가자 A' }, { id: 'b', name: '참가자 B' }],
    events: Array.from({ length: count }, (_, index) => ({ ...createHungerDraft('custom-' + index), title: '원본 ' + index })),
    seed: 'fresh-event-editor', matchMode: 'solo', maxPhases: 3 });
  const run = freeze(createHungerRun(config));
  const ws = { events: freeze(config.events), roster: freeze(config.roster), run, draft: null, origin: null,
    notices: [], changes: 0, ready: true, busy: false, resets: 0 };
  ws.callbacks = {
    onChange: events => { ws.events = events; ws.changes++; },
    onDraftChange: draft => { ws.draft = draft; },
    onDraftOriginIdChange: origin => { ws.origin = origin; },
    onNotice: notice => { ws.notices.push(notice); },
    onPresetsReset: () => { ws.resets++; return false; },
  };
  return ws;
}
function mount(ws) {
  const h = { slots: [], cleanups: [], cursor: 0, tree: null };
  h.render = () => {
    h.cursor = 0; globalThis.__hungerEventEditorHarness = h;
    h.tree = Editor({ events: ws.events, roster: ws.roster, matchMode: 'solo', draft: ws.draft,
      draftOriginId: ws.origin, ready: ws.ready, busy: ws.busy, ...ws.callbacks });
    return h.tree;
  };
  h.button = label => nodes(h.tree, node => node.type === 'button').find(node => textOf(node) === label
    || (node.props['aria-pressed'] !== undefined && textOf(node).startsWith(label)));
  h.click = label => { const button = h.button(label); assert.ok(button, label); button.props.onClick(); };
  h.title = title => {
    const input = nodes(h.tree, node => node.type === 'input' && node.props.maxLength === 120)[0];
    input.props.onChange({ target: { value: title } });
  };
  h.json = value => {
    nodes(h.tree, node => node.type === 'textarea' && node.props['aria-label'] === '이벤트 JSON')[0]
      .props.onChange({ target: { value } });
    h.render(); h.click('편집기에 적용'); h.render();
  };
  h.unmount = () => { for (const cleanup of h.cleanups) cleanup?.(); };
  h.render();
  return h;
}

let confirms = 0;
let accepts = true;
const previousWindow = globalThis.window;
globalThis.window = { confirm: () => { confirms++; return accepts; } };
const originalUuid = globalThis.crypto.randomUUID;
let uuidCalls = 0;
globalThis.crypto.randomUUID = () => 'fresh-editor-' + (++uuidCalls);
let checks = 0;
const failures = [];
function check(name, run) {
  try { run(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${String(error.message).slice(0, 650)}`); }
}
try {
  check('initial fallback remembers the saved origin and only explicit save changes that event', () => {
    const ws = workspace(), h = mount(ws);
    const beforeEvents = clone(ws.events), beforeRun = clone(ws.run);
    h.title('수정한 원본 0');
    assert.equal(ws.origin, 'custom-0');
    assert.deepEqual(ws.events, beforeEvents);
    h.render(); h.click('이벤트 저장');
    assert.equal(ws.events[0].title, '수정한 원본 0');
    assert.equal(ws.events.length, 2);
    assert.deepEqual(ws.events[1], beforeEvents[1]);
    assert.deepEqual(ws.run, beforeRun);
    assert.equal(ws.origin, 'custom-0');
  });

  check('the real duplicate handler creates an independent unique draft and preserves source, others and run input', () => {
    const ws = workspace(), h = mount(ws);
    const before = clone(ws.events), beforeRun = clone(ws.run);
    h.click('새 ID로 복제');
    assert.equal(ws.origin, null);
    assert.ok(!before.some(event => event.id === ws.draft.id));
    assert.deepEqual(ws.events, before);
    const copyId = ws.draft.id;
    h.render(); h.title('내가 만든 복제 사건'); h.render();
    h.click('이벤트 저장');
    assert.equal(ws.events.length, 3);
    assert.equal(ws.events[2].id, copyId);
    assert.equal(ws.events[2].title, '내가 만든 복제 사건');
    assert.deepEqual(ws.events.slice(0, 2), before);
    assert.deepEqual(ws.run, beforeRun);
    assert.equal(new Set(ws.events.map(event => event.id)).size, 3);
  });

  check('adding a fresh event clears old casting, injury, survivor, duel and JSON preview setup', () => {
    const ws = workspace();
    ws.roster = [...ws.roster, { ...ws.roster[0], id: 'c', name: '참가자 C' }];
    const h = mount(ws);
    const field = title => nodes(h.tree, node => node.type === 'label' && textOf(node).startsWith(title))[0];
    const cast = () => nodes(h.tree, node => typeof node.type === 'function' && node.type.name === 'Select'
      && node.props.options?.some(option => option.value === 'c'))[0];
    cast().props.onChange('b');
    nodes(field('부상 상태로 시험'), node => node.type === 'input')[0].props.onChange({ target: { checked: true } });
    nodes(field('시험 생존자 수'), node => node.type === 'input')[0].props.onChange({ target: { value: '2' } });
    nodes(field('최종 2인 대치 경과 페이즈'), node => node.type === 'input')[0].props.onChange({ target: { value: '5' } });
    nodes(h.tree, node => node.type === 'textarea' && node.props['aria-label'] === '이벤트 JSON')[0]
      .props.onChange({ target: { value: '아직 적용하지 않은 JSON 입력' } });
    h.render();
    assert.equal(cast().props.value, 'b');
    h.click('추가'); h.render();
    assert.equal(ws.origin, null);
    assert.equal(cast().props.value, 'a');
    assert.equal(nodes(field('부상 상태로 시험'), node => node.type === 'input')[0].props.checked, false);
    assert.equal(nodes(field('시험 생존자 수'), node => node.type === 'input')[0].props.value, 3);
    assert.equal(nodes(field('최종 2인 대치 경과 페이즈'), node => node.type === 'input')[0].props.value, 0);
    assert.equal(nodes(h.tree, node => node.type === 'textarea' && node.props['aria-label'] === '이벤트 JSON')[0].props.value, '');
    assert.equal(ws.events.length, 2);
  });

  check('JSON targeting another saved ID is blocked with a reason and a working new-ID copy route', () => {
    const ws = workspace(), h = mount(ws), before = clone(ws.events);
    const confirmBefore = confirms;
    h.json(JSON.stringify({ ...before[0], id: before[1].id, title: '다른 사건 덮기 시도' }));
    assert.equal(ws.origin, before[0].id);
    assert.equal(ws.draft.id, before[1].id);
    assert.equal(h.button('이벤트 저장').props.disabled, true);
    assert.match(renderToStaticMarkup(h.tree), /다른 저장된 이벤트|다른 이벤트를 덮어쓸 수 없습니다/);
    h.click('이벤트 저장');
    assert.deepEqual(ws.events, before);
    assert.equal(ws.changes, 0);
    h.click('새 ID로 복제'); h.render(); h.click('이벤트 저장');
    assert.deepEqual(ws.events.slice(0, 2), before);
    assert.equal(ws.events.length, 3);
    assert.equal(confirms, confirmBefore, 'JSON application and collision recovery must not add native dialogs.');
  });

  check('tab unmount and remount retain origin instead of turning a pasted collision into ownership', () => {
    const ws = workspace(); let h = mount(ws);
    const before = clone(ws.events);
    h.json(JSON.stringify({ ...before[0], id: before[1].id, title: '탭 복귀 후 충돌' }));
    const oldSave = h.button('이벤트 저장').props.onClick;
    h.unmount(); h = mount(ws);
    assert.equal(ws.origin, before[0].id);
    assert.equal(h.button('이벤트 저장').props.disabled, true);
    oldSave(); h.click('이벤트 저장');
    assert.deepEqual(ws.events, before);
    assert.equal(ws.changes, 0);
  });

  check('a unique JSON ID saves an additional event while explicitly preserving the original', () => {
    const ws = workspace(), h = mount(ws), before = clone(ws.events);
    h.json(JSON.stringify({ ...before[0], id: 'unique-renamed-copy', title: '별도 이름의 사건' }));
    assert.match(renderToStaticMarkup(h.tree), /원래 이벤트는 그대로 두고 별도 이벤트를 추가/);
    h.click('이벤트 저장');
    assert.equal(ws.events.length, 3);
    assert.deepEqual(ws.events.slice(0, 2), before);
    assert.equal(ws.origin, 'unique-renamed-copy');
    assert.match(ws.notices.at(-1), /원래 이벤트는 유지/);
  });

  check('at 200 events new copies and additions are blocked without losing drafts while original edits remain allowed', () => {
    const ws = workspace(200), h = mount(ws);
    const before = clone(ws.events), beforeCalls = uuidCalls;
    assert.equal(h.button('새 ID로 복제').props.disabled, true);
    assert.equal(h.button('추가').props.disabled, true);
    h.click('새 ID로 복제'); h.click('추가');
    assert.equal(ws.draft, null);
    assert.equal(uuidCalls, beforeCalls);
    h.title('한도 안의 기존 원본 수정'); h.render();
    assert.equal(h.button('이벤트 저장').props.disabled, false);
    h.click('이벤트 저장'); h.render();
    assert.equal(ws.events.length, 200);
    assert.equal(ws.events[0].title, '한도 안의 기존 원본 수정');
    assert.deepEqual(ws.events.slice(1), before.slice(1));
    h.json(JSON.stringify({ ...ws.draft, id: 'over-capacity-copy' }));
    const draft = clone(ws.draft);
    assert.equal(h.button('이벤트 저장').props.disabled, true);
    h.click('이벤트 저장');
    assert.equal(ws.events.length, 200);
    assert.deepEqual(ws.draft, draft);
    assert.match(ws.notices.at(-1), /200개/);
  });

  check('invalid JSON syntax, weights and role references preserve the prior draft and ownership', () => {
    const ws = workspace(), h = mount(ws);
    h.title('유지할 초안'); h.render();
    const before = clone(ws.draft), events = clone(ws.events);
    for (const raw of ['{', JSON.stringify({ ...before, weight: 0 }),
      JSON.stringify({ ...before, outcomes: [{ text: '{missing}은 행동한다.' }] })]) {
      h.json(raw);
      assert.deepEqual(ws.draft, before);
      assert.equal(ws.origin, 'custom-0');
      assert.deepEqual(ws.events, events);
      assert.equal(ws.changes, 0);
    }
  });

  check('existing discard and delete confirmations preserve cancelled material and require deliberate source selection', () => {
    const ws = workspace(), h = mount(ws), original = clone(ws.events);
    h.title('아직 저장하지 않은 원본 수정'); h.render();
    const draft = clone(ws.draft);
    accepts = false;
    h.click('● 원본 1');
    assert.deepEqual(ws.draft, draft);
    assert.equal(ws.origin, 'custom-0');
    h.click('삭제');
    assert.deepEqual(ws.events, original);
    accepts = true;
    h.click('● 원본 1'); h.render();
    assert.equal(ws.origin, 'custom-1');
    h.title('의도한 원본 1 수정'); h.render(); h.click('이벤트 저장'); h.render();
    assert.equal(ws.events[1].title, '의도한 원본 1 수정');
    h.click('삭제');
    assert.equal(ws.events.length, 1);
    assert.deepEqual(ws.events[0], original[0]);
    assert.equal(ws.origin, 'custom-0');
  });

  check('busy, not-ready, replaced renders and unmounted handlers cannot edit, generate IDs or run preset callbacks', () => {
    const ws = workspace(), h = mount(ws);
    const oldCopy = h.button('새 ID로 복제').props.onClick;
    const oldSave = h.button('이벤트 저장').props.onClick;
    const oldReset = h.button('기본 사건 업데이트').props.onClick;
    const oldTitle = nodes(h.tree, node => node.type === 'input' && node.props.maxLength === 120)[0].props.onChange;
    const before = clone(ws.events), ids = uuidCalls;
    ws.busy = true; h.render();
    assert.equal(h.tree.props.disabled, true);
    oldCopy(); oldSave(); oldReset(); oldTitle({ target: { value: '오래된 입력' } });
    h.click('새 ID로 복제'); h.click('이벤트 저장'); h.click('기본 사건 업데이트');
    assert.deepEqual(ws.events, before); assert.equal(ws.draft, null); assert.equal(ws.origin, null);
    assert.equal(uuidCalls, ids); assert.equal(ws.resets, 0);
    ws.busy = false; ws.ready = false; h.render(); h.click('새 ID로 복제');
    assert.equal(ws.draft, null);
    ws.ready = true; h.render();
    oldCopy(); oldSave(); assert.equal(ws.draft, null);
    h.click('새 ID로 복제'); h.render();
    const priorCopy = h.button('새 ID로 복제').props.onClick;
    const retained = clone(ws.draft);
    h.unmount(); priorCopy();
    assert.deepEqual(ws.draft, retained);
    assert.equal(uuidCalls, ids + 1);
  });

  check('duplicate IDs retry safely and copied twelve-branch/effect structures remain detached and contract-valid', () => {
    const branches = Array.from({ length: 12 }, (_, index) => ({ label: '분기 ' + index, weight: index + 1,
      text: '{actor}은 물품을 찾는다.', effects: Array.from({ length: 12 }, (_, item) => ({
        type: 'gain_item', target: 'actor', item: '물품 ' + item })) }));
    const original = freeze(normalizeHungerEvent({ ...createHungerDraft('original'), outcomes: branches }));
    const before = clone(original);
    const ids = ['original', 'other', 'unique-copy'];
    const copied = copyHungerEventDraft([original, { ...original, id: 'other' }], original, () => ids.shift());
    assert.equal(copied.id, 'unique-copy');
    assert.equal(copied.outcomes.length, 12);
    assert.ok(copied.outcomes.every(row => row.effects.length === 12));
    copied.outcomes[0].effects[0].item = '복제에서 바꾼 물품';
    assert.deepEqual(original, before);
    assert.doesNotThrow(() => normalizeHungerEvent(copied));
  });
} finally {
  globalThis.window = previousWindow;
  globalThis.crypto.randomUUID = originalUuid;
  delete globalThis.__hungerEventEditorHarness;
}
console.log(JSON.stringify({ passed: failures.length === 0, checks, failures,
  scope: 'Fresh real editor handlers with a controlled hook lifecycle and actual contract/config/run inputs. No browser, account writes, gameplay-rule change or draft persistence claim.' }));
if (failures.length) process.exitCode = 1;
