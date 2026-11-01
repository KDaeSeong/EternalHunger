import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import nextImageModule from 'next/image.js';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
import { parseHungerItemDraft, createHungerRosterImageRequests } from '../src/app/hungergames/_lib/hungerGameRosterEditor.js';
import { normalizeHungerRoster } from '../src/app/hungergames/_lib/hungerGameContract.js';
import { createHungerPack } from '../src/app/hungergames/_lib/hungerGamePersistence.js';
import { defaultHungerConfig } from '../src/app/hungergames/_lib/hungerGamePresets.js';

const componentUrl = new URL('../src/app/hungergames/_components/HungerRosterEditor.js', import.meta.url).href;
const traitsUrl = new URL('../src/components/HungerTraitFields.js', import.meta.url).href;
const pending = new Map();
globalThis.__rosterEditorTest = { React, Image: nextImageModule.default,
  read: (file) => new Promise((resolve, reject) => pending.set(file.name, { resolve, reject })) };
const sourceModule = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === componentUrl) {
      if (specifier === 'react') return sourceModule(`
        export function useRef(initial) { const hooks=globalThis.__rosterEditorTest.hooks;
          return hooks ? hooks.useRef(initial) : globalThis.__rosterEditorTest.React.useRef(initial); }
        export function useLayoutEffect(effect,deps) { const hooks=globalThis.__rosterEditorTest.hooks;
          return hooks ? hooks.useLayoutEffect(effect,deps) : globalThis.__rosterEditorTest.React.useLayoutEffect(effect,deps); }`);
      if (specifier === 'next/image') return sourceModule('export default globalThis.__rosterEditorTest.Image;');
      if (specifier.endsWith('/previewImage')) return sourceModule('export function readCompressedPreviewImage(file) { return globalThis.__rosterEditorTest.read(file); }');
      if (specifier.endsWith('.module.css')) return sourceModule('export default new Proxy({}, {get:(_,key)=>String(key)});');
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (![componentUrl, traitsUrl].includes(url)) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Roster } = await import(componentUrl);
const { default: Traits } = await import(traitsUrl);
const actor = (id, extra = {}) => ({ id, name: `참가자 ${id}`, previewImage: '/old.png', teamId: '', districtId: '', hungerTraits: [], items: ['칼'], ...extra });
const nodes = (node, predicate) => {
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap((child) => nodes(child, predicate))];
};
const textOf = (node) => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
function harness(shared = { roster: [actor('a'), actor('b')], revision: 0, drafts: { revision: 0, byId: {} }, ready: true, busy: false }) {
  const cells = []; let cursor = 0; let effects = []; const notices = [];
  const hooks = {
    useRef(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index]; },
    useLayoutEffect(effect, deps) {
      const index = cursor++; const prior = cells[index];
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) effects.push(() => {
        prior?.cleanup?.(); cells[index] = { deps, cleanup: effect() };
      });
    },
  };
  const props = () => ({ roster: shared.roster, matchMode: shared.matchMode || 'team', rosterRevision: shared.revision,
    itemDrafts: shared.drafts, ready: shared.ready, busy: shared.busy,
    onChange: (value) => { shared.roster = typeof value === 'function' ? value(shared.roster) : value; },
    onItemDraftsChange: (value) => { shared.drafts = typeof value === 'function' ? value(shared.drafts) : value; },
    onNotice: (message) => notices.push(message), onLoadAccount: () => notices.push('account-fixture') });
  const draw = () => {
    cursor = 0; effects = []; globalThis.__rosterEditorTest.hooks = hooks;
    try { const tree = Roster(props()); effects.forEach((effect) => effect()); return tree; }
    finally { delete globalThis.__rosterEditorTest.hooks; }
  };
  return { shared, notices, draw, props,
    unmount() { cells.forEach((cell) => cell?.cleanup?.()); },
    card(id) { return nodes(draw(), (node) => node.type === 'article' && (node.key === id || String(node.key).endsWith(`$${id}`)))[0]; },
    field(id, label) {
      const card = this.card(id); const row = nodes(card, (node) => node.type === 'label' && textOf(node).startsWith(label))[0];
      return nodes(row, (node) => node.type === 'input')[0];
    },
    button(id, label) { return nodes(this.card(id), (node) => node.type === 'button' && textOf(node) === label)[0]; },
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const upload = (app, id, name) => app.field(id, '사진').props.onChange({ target: { files: [{ name }], value: 'file' } });
let checks = 0;
const check = async (name, run) => { await run(); checks += 1; console.log(`PASS ${name}`); };

await check('comma and space typing retain raw text while every committed array follows the existing item contract', () => {
  const app = harness();
  try {
    for (const character of ', 식량') {
      const input = app.field('a', '시작 아이템'); input.props.onChange({ target: { value: input.props.value + character } });
    }
    assert.equal(app.field('a', '시작 아이템').props.value, '칼, 식량');
    assert.deepEqual(app.shared.roster[0].items, ['칼', '식량']);
    app.field('a', '시작 아이템').props.onChange({ target: { value: ' 칼,  식량, 칼, ' } });
    assert.equal(app.field('a', '시작 아이템').props.value, ' 칼,  식량, 칼, ');
    assert.deepEqual(app.shared.roster[0].items, ['칼', '식량']);
    app.field('a', '시작 아이템').props.onBlur({ target: { value: ' 칼,  식량, 칼, ' } });
    assert.equal(app.field('a', '시작 아이템').props.value, '칼, 식량'); assert.deepEqual(app.shared.drafts.byId, {});
    assert.deepEqual(normalizeHungerRoster(app.shared.roster)[0].items, ['칼', '식량']);
  } finally { app.unmount(); }
});
await check('invalid item drafts remain visible across blur and unmount while exported canonical data stays valid', () => {
  const app = harness(); const tooMany = Array.from({ length: 13 }, (_, index) => `도구${index}`).join(', ');
  app.field('a', '시작 아이템').props.onChange({ target: { value: tooMany } });
  assert.equal(app.field('a', '시작 아이템').props.value, tooMany); assert.deepEqual(app.shared.roster[0].items, ['칼']);
  assert.match(app.shared.drafts.byId.a.error, /12/);
  app.field('a', '시작 아이템').props.onBlur({ target: { value: tooMany } });
  const shared = app.shared; app.unmount(); const remounted = harness(shared);
  try {
    assert.equal(remounted.field('a', '시작 아이템').props.value, tooMany);
    const html = renderToStaticMarkup(React.createElement(Roster, remounted.props()));
    assert.match(html, /aria-invalid="true"/); assert.match(html, /role="alert"/); assert.ok(html.includes('마지막 유효 아이템만 저장됩니다.'));
    const pack = createHungerPack({ ...defaultHungerConfig(), roster: shared.roster });
    assert.deepEqual(pack.config.roster[0].items, ['칼']); assert.ok(!Object.hasOwn(pack, 'itemDrafts'));
    remounted.field('a', '시작 아이템').props.onChange({ target: { value: '가'.repeat(61) } });
    assert.match(shared.drafts.byId.a.error, /60/); assert.deepEqual(shared.roster[0].items, ['칼']);
    remounted.field('a', '시작 아이템').props.onChange({ target: { value: '식량, 밧줄' } });
    assert.equal(shared.drafts.byId.a.error, ''); assert.deepEqual(shared.roster[0].items, ['식량', '밧줄']);
  } finally { remounted.unmount(); }
});
await check('ID-based drafts survive reorder, delete only their own entry and cannot attach to a replaced roster revision', () => {
  const app = harness();
  try {
    app.field('a', '시작 아이템').props.onChange({ target: { value: '칼, ' } });
    app.field('b', '시작 아이템').props.onChange({ target: { value: '밧줄, ' } });
    app.shared.roster = app.shared.roster.slice().reverse();
    assert.equal(app.field('a', '시작 아이템').props.value, '칼, '); assert.equal(app.field('b', '시작 아이템').props.value, '밧줄, ');
    app.button('a', '삭제').props.onClick(); assert.ok(!Object.hasOwn(app.shared.drafts.byId, 'a'));
    assert.equal(app.shared.drafts.byId.b.text, '밧줄, ');
    app.shared.revision += 1; app.shared.roster = [actor('b', { items: ['새 장비'] })];
    assert.equal(app.field('b', '시작 아이템').props.value, '새 장비');
  } finally { app.unmount(); }
});
await check('photo removal and latest upload defeat late decoding, including a failed latest request', async () => {
  const app = harness();
  try {
    upload(app, 'a', 'removed'); app.button('a', '사진 제거').props.onClick();
    pending.get('removed').resolve('/removed-late.png'); await flush(); assert.equal(app.shared.roster[0].previewImage, '');
    upload(app, 'a', 'first'); upload(app, 'a', 'second');
    pending.get('second').resolve('/second.png'); await flush(); pending.get('first').resolve('/first-late.png'); await flush();
    assert.equal(app.shared.roster[0].previewImage, '/second.png');
    upload(app, 'a', 'older'); upload(app, 'a', 'failed-latest');
    pending.get('failed-latest').reject(new Error('읽기 실패')); await flush();
    pending.get('older').resolve('/older-late.png'); await flush();
    assert.equal(app.shared.roster[0].previewImage, '/second.png'); assert.deepEqual(app.notices, ['읽기 실패']);
    upload(app, 'a', 'empty-image'); pending.get('empty-image').resolve(''); await flush();
    assert.equal(app.shared.roster[0].previewImage, '/second.png'); assert.match(app.notices.at(-1), /용량/);
  } finally { app.unmount(); }
});
await check('photo operations remain per participant and preserve concurrent name, trait and item edits', async () => {
  const app = harness();
  try {
    upload(app, 'a', 'actor-a'); upload(app, 'b', 'actor-b');
    app.field('a', '이름').props.onChange({ target: { value: '수정한 이름' } });
    const traits = nodes(app.card('a'), (node) => node.type === Traits)[0]; traits.props.onChange(['fire_control']);
    app.field('a', '시작 아이템').props.onChange({ target: { value: '밧줄, 식량' } });
    pending.get('actor-a').resolve('/a.png'); pending.get('actor-b').resolve('/b.png'); await flush();
    assert.equal(app.shared.roster[0].name, '수정한 이름'); assert.deepEqual(app.shared.roster[0].hungerTraits, ['fire_control']);
    assert.deepEqual(app.shared.roster[0].items, ['밧줄', '식량']);
    assert.equal(app.shared.roster[0].previewImage, '/a.png'); assert.equal(app.shared.roster[1].previewImage, '/b.png');
  } finally { app.unmount(); }
});
await check('deletion, same-ID roster replacement, busy transition and unmount invalidate pending images', async () => {
  for (const mode of ['delete', 'replace', 'busy', 'unmount']) {
    const app = harness(); upload(app, 'a', `lifecycle-${mode}`);
    if (mode === 'delete') app.button('a', '삭제').props.onClick();
    if (mode === 'replace') { app.shared.revision += 1; app.shared.roster = [actor('a', { previewImage: '/replacement.png' })]; app.draw(); }
    if (mode === 'busy') { app.shared.busy = true; app.draw(); }
    if (mode === 'unmount') app.unmount();
    const before = JSON.stringify(app.shared.roster);
    pending.get(`lifecycle-${mode}`).resolve('/stale.png'); await flush();
    assert.equal(JSON.stringify(app.shared.roster), before); app.unmount();
  }
});
await check('ready and busy locks disable and guard every mutation without starting photo work', () => {
  for (const extra of [{ ready: false }, { busy: true }]) {
    const app = harness(); Object.assign(app.shared, extra); const tree = app.draw();
    try {
      for (const input of nodes(tree, (node) => node.type === 'input')) assert.equal(input.props.disabled, true);
      for (const button of nodes(tree, (node) => node.type === 'button')) assert.equal(button.props.disabled, true);
      assert.equal(nodes(tree, (node) => node.type === Traits)[0].props.disabled, true);
      const before = JSON.stringify(app.shared); const beforeReads = pending.size;
      app.field('a', '이름').props.onChange({ target: { value: '잠긴 수정' } });
      app.field('a', '시작 아이템').props.onChange({ target: { value: '잘못된 수정' } });
      app.button('a', '삭제').props.onClick(); app.button('a', '사진 제거').props.onClick(); upload(app, 'a', 'locked');
      nodes(tree, (node) => node.type === 'button' && textOf(node) === '참가자 추가')[0].props.onClick();
      nodes(tree, (node) => node.type === 'button' && textOf(node) === '내 캐릭터 불러오기')[0].props.onClick();
      assert.equal(JSON.stringify(app.shared), before); assert.equal(pending.size, beforeReads); assert.deepEqual(app.notices, []);
    } finally { app.unmount(); }
  }
});
await check('item parsing uses existing limits and image request tokens are released after invalidation and remount activation', () => {
  assert.deepEqual(parseHungerItemDraft(' 칼, 칼, 식량, ').items, ['칼', '식량']);
  assert.deepEqual(parseHungerItemDraft(' , ').items, []);
  assert.ok(parseHungerItemDraft(Array.from({ length: 13 }, () => '칼').join(',')).error);
  const requests = createHungerRosterImageRequests(); const first = requests.begin('a');
  requests.deactivate(); assert.equal(requests.begin('a'), null);
  requests.activate(); assert.equal(requests.isCurrent('a', first), false);
  const second = requests.begin('a'); assert.equal(requests.isCurrent('a', second), true);
  requests.retain(new Set(['b'])); assert.equal(requests.isCurrent('a', second), false);
  const third = requests.begin('a'); requests.invalidate('a'); assert.equal(requests.isCurrent('a', third), false);
});
delete globalThis.__rosterEditorTest;
console.log(JSON.stringify({ pass: true, checks,
  scope: 'Actual roster JSX and Next Image SSR, memory layout lifecycle and real item normalization; deferred compression boundary tests. No browser image decoding, parent ownership, real storage/account calls, build or full HG regression.' }));
