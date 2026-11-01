import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import postcss from 'postcss';
import { createHungerRun, advanceHungerRun } from '../src/app/hungergames/_lib/hungerGameRuntime.js';

const root = new URL('../', import.meta.url);
const viewerUrl = new URL('src/app/hungergames/_components/HungerRunViewer.js', root).href;
const cssUrl = new URL('src/app/hungergames/HungerGames.module.css', root).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(context.parentURL === viewerUrl && specifier === 'next/image' ? 'next/image.js' : specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === cssUrl) return { format: 'module', shortCircuit: true,
      source: 'export default new Proxy({}, { get: (_, name) => String(name) });' };
    if (url !== viewerUrl) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
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
let run = createHungerRun({ seed: 'observer-view-20261101', maxPhases: 4,
  roster: [{ id: 'a', name: '관전 대상', hungerTraits: ['observer_target'] },
    { id: 'b', name: '동료' }, { id: 'c', name: '다른 참가자' }],
  events: [{ id: 'observed-loss', title: '기록된 탈락', phases: ['night'],
    roles: [{ key: 'actor', allTraits: ['observer_target'] }],
    outcomes: [{ label: '탈락', text: '{actor}은 밤의 사고로 탈락한다.', weight: 1,
      effects: [{ target: 'actor', type: 'death', cause: 'accident' }] }] }],
});
while (!run.finished) run = advanceHungerRun(run);
freeze(run);
assert.equal(run.history.length, 4);
assert.equal(run.actors[0].death.phaseIndex, 2);
const original = JSON.stringify(run);
const props = (extra = {}) => ({ run, viewIndex: -1, onViewIndex: () => {}, onFollowActor: () => {}, ...extra });
const nodes = (node, predicate) => !node || typeof node !== 'object' ? []
  : [...(predicate(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child, predicate))];
const textOf = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : React.Children.toArray(node?.props?.children).map(textOf).join('');
const markup = input => renderToStaticMarkup(React.createElement(Viewer, input));
let checks = 0;
const check = (name, test) => { test(); checks += 1; console.log(`PASS ${name}`); };

check('all events remain visible by default and unknown selections fall back to all', () => {
  for (const followActorId of ['', 'absent-from-this-roster']) {
    const tree = Viewer(props({ followActorId }));
    assert.equal(nodes(tree, node => node.type === 'article').length, 2);
    assert.match(markup(props({ followActorId })), /전체 사건 2건/);
  }
});
check('a followed actor filters real phase receipts without hiding the global population', () => {
  const input = props({ viewIndex: 0, followActorId: 'a' });
  const tree = Viewer(input);
  assert.equal(nodes(tree, node => node.type === 'article').length, 1);
  const html = markup(input);
  assert.match(html, /관전 대상 등장 1건 \/ 전체 3건/);
  assert.ok(nodes(tree, node => node.type === 'h2').some(node => textOf(node) === '당시 생존자 3 / 3'));
  assert.ok(!html.includes('탈락 원인:'));
  assert.equal(nodes(tree, node => node.props.className === 'result').length, 0);
});
check('an absent eliminated actor can return only to an already observed appearance', () => {
  let destination = null;
  const tree = Viewer(props({ followActorId: 'a', onViewIndex: index => { destination = index; } }));
  assert.equal(nodes(tree, node => node.type === 'article').length, 0);
  assert.match(markup(props({ followActorId: 'a' })), /이 페이즈에는 선택한 참가자의 등장 사건이 없습니다/);
  const button = nodes(tree, node => node.type === 'button').find(node => textOf(node) === '최근 등장 기록');
  assert.equal(button.props.disabled, false); button.props.onClick();
  assert.equal(destination, 2);
  const past = Viewer(props({ viewIndex: 1, followActorId: 'a', onViewIndex: index => { destination = index; } }));
  const pastButton = nodes(past, node => node.type === 'button').find(node => textOf(node) === '최근 등장 기록');
  assert.equal(pastButton.props.disabled, true); pastButton.props.onClick();
  assert.equal(destination, 2);
  assert.ok(!markup(props({ viewIndex: 1, followActorId: 'a' })).includes('탈락 원인:'));
});
check('participant selection invokes only its presentation callback', () => {
  let selected = null;
  const tree = Viewer(props({ onFollowActor: id => { selected = id; } }));
  nodes(tree, node => node.type === 'select')[0].props.onChange({ target: { value: 'b' } });
  assert.equal(selected, 'b');
  assert.equal(JSON.stringify(run), original);
});
check('waiting, unavailable callbacks and presentation never mutate or draw gameplay randomness', () => {
  const waiting = freeze(createHungerRun(run.input));
  assert.match(markup(props({ run: waiting, followActorId: 'a' })), /아직 진행한 사건이 없습니다/);
  assert.equal(nodes(Viewer(props({ onFollowActor: undefined })), node => node.type === 'select')[0].props.disabled, true);
  const random = Math.random;
  try { Math.random = () => { throw Error('Presentation must not draw randomness'); }; Viewer(props({ followActorId: 'a' })); }
  finally { Math.random = random; }
  assert.equal(JSON.stringify(run), original);
  postcss.parse(readFileSync(new URL(cssUrl), 'utf8'));
});
console.log(JSON.stringify({ passed: true, checks,
  scope: 'Actual viewer SSR and handlers with fresh engine receipts; CSS modules mapped to stable class labels. Not browser layout or foreground performance.' }));
