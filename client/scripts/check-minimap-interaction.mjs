import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Render the actual components, not a substitute map. This checks markup and
// ownership only; hit testing, scrolling and zoom still need browser evidence.
const componentUrls = new Set([
  '../src/app/simulation/_components/SimulationMinimapCanvas.js',
  '../src/app/simulation/_components/SimulationMinimapPanel.js',
  '../src/app/simulation/_components/SimulationMinimapHyperloopControl.js',
  '../src/app/games/_components/GameActionIcon.js',
].map((path) => new URL(path, import.meta.url).href));
registerHooks({
  load(url, context, nextLoad) {
    if (!componentUrls.has(url)) return nextLoad(url, context);
    const source = readFileSync(new URL(url), 'utf8');
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Panel } = await import('../src/app/simulation/_components/SimulationMinimapPanel.js');
const live = Object.freeze({ _id: 'live', name: '생존자', hp: 114, maxHp: 146, zoneId: 'apartment', teamId: 'team:4', teamName: '4팀' });
const dead = Object.freeze({ ...live, _id: 'dead', name: '사망자', hp: 0 });
const props = { survivors: [live], dead: [dead], zones: [{ zoneId: 'apartment', name: '고급 주택가' }],
  zonePos: {}, zoneEdges: [], trackedActorIds: ['live'], getZoneName: () => '고급 주택가',
  forbiddenNow: new Set(), hyperloopZoneSet: new Set(), openMap: () => {}, closeUiModal: () => {} };
const before = JSON.stringify([live, dead]);
const inline = renderToStaticMarkup(React.createElement(Panel, props));
const expanded = renderToStaticMarkup(React.createElement(Panel, { ...props, uiModal: 'map' }));
let passed = 0;
const check = (name, run) => { run(); passed += 1; console.log(`PASS ${name}`); };
check('dead markers are not pointer targets', () => {
  const mark = inline.match(/<circle\b[^>]*class="minimap-dead-token"[^>]*>/)?.[0];
  assert.ok(mark, 'dead markers need an explicit non-interactive presentation');
  assert.match(mark, /pointer-events="none"/);
});
check('dead markers render behind living actors in the same zone', () => {
  assert.ok(inline.indexOf('class="minimap-dead-token"') >= 0);
  assert.ok(inline.indexOf('class="minimap-dead-token"') < inline.indexOf('class="minimap-character-token'));
});
check('living actor keeps the accessible roster action and exact HP', () => {
  assert.match(inline, /role="button"[^>]*tabindex="0"/);
  assert.match(inline, /생존자 \/ 4팀 \/ HP 114\/146/);
  assert.match(inline, /참가자 보기/);
});
check('expanded map starts fitted and exposes explicit zoom controls', () => {
  assert.match(expanded, /class="minimap-expanded-view"/);
  assert.match(expanded, /aria-label="지도 전체 보기" aria-pressed="true"/);
  assert.match(expanded, /aria-label="지도 2배 확대" aria-pressed="false"/);
  assert.match(expanded, /class="minimap-viewport"[^>]*tabindex="0"/);
  assert.doesNotMatch(expanded, /class="minimap-viewport is-zoomed"/);
});
check('inline map does not inherit the modal-only viewport', () => {
  assert.doesNotMatch(inline, /minimap-expanded-view|minimap-viewport/);
  assert.match(inline, /크게 보기/);
});
check('custom maps use the same expanded viewport', () => {
  const html = renderToStaticMarkup(React.createElement(Panel, { ...props, uiModal: 'map', activeMapId: 'local-map-check',
    zones: [{ zoneId: 'apartment', name: '고급 주택가', x: 20, y: 20 }] }));
  assert.match(html, /사용자 지도 미니맵/);
  assert.match(html, /minimap-expanded-view/);
});
check('empty map and original actor ownership are preserved', () => {
  const html = renderToStaticMarkup(React.createElement(Panel, { ...props, zones: [], uiModal: 'map' }));
  assert.match(html, /미니맵 데이터가 없습니다/);
  assert.equal(JSON.stringify([live, dead]), before);
});
console.log(JSON.stringify({ passed, scope: 'actual component SSR; not browser hit testing or visual acceptance' }));
