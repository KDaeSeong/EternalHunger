import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Use the production JSX component and the existing minimap SSR load path.
// Comparing canonical/legacy geometry is an identity contract, not proof that
// the polygon traces align with the reference image in a rendered browser.
const canvasUrl = new URL('../src/app/simulation/_components/SimulationMinimapCanvas.js', import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    if (url !== canvasUrl) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Canvas } = await import(canvasUrl);
const names = { park: '연못', pond: '연못', apartment: '고급 주택가', residential: '고급 주택가', unknown: '미등록 지역' };
const canonical = ['park', 'apartment'];
const legacy = ['pond', 'residential'];
const fingerprints = [];
const fingerprint = (value) => JSON.stringify(value, (_, entry) => entry instanceof Set ? { setValues: [...entry] } : entry);
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function render(zoneIds, restricted, expanded = false) {
  const props = freeze({
    activeMapId: 'guest-lumia-island', expanded, fitViewport: true,
    zones: zoneIds.map(zoneId => ({ zoneId, name: names[zoneId] || zoneId, isForbidden: false })),
    survivors: [], dead: [], zoneEdges: [], zonePos: {}, trackedActorIds: [],
    forbiddenNow: restricted, hyperloopZoneSet: new Set(),
    getZoneName: zoneId => names[zoneId] || zoneId,
  });
  const before = fingerprint(props);
  const html = renderToStaticMarkup(React.createElement(Canvas, props));
  fingerprints.push({ props, before });
  assert.equal(fingerprint(props), before, 'Rendering must not alter actual zone IDs, Sets, arrays or other props');
  return [...html.matchAll(/<polygon\b([^>]*)>/g)].flatMap(([, attributes]) => {
    const attr = name => attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
    const classNames = String(attr('class') || '').split(/\s+/);
    if (!classNames.includes('minimap-zone-area') || !classNames.includes('forbidden')) return [];
    return [{ zoneId: attr('data-zone-id'), points: attr('points') }];
  }).sort((a, b) => String(a.zoneId).localeCompare(String(b.zoneId)));
}
function expectAreas(rows, ids) {
  assert.deepEqual(rows.map(row => row.zoneId).sort(), [...ids].sort(), 'Every registered restricted ID needs exactly one full-area polygon under its original ID');
  for (const row of rows) assert.ok(String(row.points || '').trim().split(/\s+/).length >= 3, 'A full area requires a nonempty polygon, not the fallback circle');
}
const checks = [
  ['canonical restricted areas retain both actual IDs', () => expectAreas(render(canonical, new Set(canonical)), canonical)],
  ['supported legacy restricted areas retain both actual IDs', () => expectAreas(render(legacy, new Set(legacy)), legacy)],
  ['legacy areas reuse their canonical full geometry without changing membership IDs', () => {
    const originals = render(canonical, new Set(canonical));
    const aliases = render(legacy, new Set(legacy));
    expectAreas(originals, canonical); expectAreas(aliases, legacy);
    for (const [actual, reference] of [['pond', 'park'], ['residential', 'apartment']]) {
      assert.equal(aliases.find(row => row.zoneId === actual)?.points, originals.find(row => row.zoneId === reference)?.points);
    }
  }],
  ['canonical Set and array membership are equivalent', () => {
    const set = render(canonical, new Set(canonical)), array = render(canonical, [...canonical]);
    expectAreas(set, canonical); expectAreas(array, canonical); assert.deepEqual(set, array);
  }],
  ['legacy Set and array membership are equivalent', () => {
    const set = render(legacy, new Set(legacy)), array = render(legacy, [...legacy]);
    expectAreas(set, legacy); expectAreas(array, legacy); assert.deepEqual(set, array);
  }],
  ['canonical inline and expanded modes use the same actual restricted areas', () => {
    const inline = render(canonical, new Set(canonical)), expanded = render(canonical, new Set(canonical), true);
    expectAreas(inline, canonical); expectAreas(expanded, canonical); assert.deepEqual(inline, expanded);
  }],
  ['legacy inline and expanded modes use the same actual restricted areas', () => {
    const inline = render(legacy, new Set(legacy)), expanded = render(legacy, new Set(legacy), true);
    expectAreas(inline, legacy); expectAreas(expanded, legacy); assert.deepEqual(inline, expanded);
  }],
  ['empty Set and array draw no restricted area', () => {
    for (const ids of [canonical, legacy]) for (const empty of [new Set(), []]) expectAreas(render(ids, empty), []);
  }],
  ['unknown restricted IDs cannot create a known full area', () => {
    expectAreas(render(canonical, new Set(['unknown'])), []);
    expectAreas(render([...canonical, 'unknown'], new Set(['unknown'])), []);
  }],
  ['known but unregistered restricted IDs are excluded', () => expectAreas(render(['park'], new Set(['apartment'])), [])],
  ['unregistered aliases and canonical counterparts do not replace actual membership', () => {
    expectAreas(render(['park'], new Set(['pond'])), []);
    expectAreas(render(['pond'], new Set(['park'])), []);
    expectAreas(render(['residential'], new Set(['apartment'])), []);
    expectAreas(render(['apartment'], new Set(['residential'])), []);
  }],
  ['mixed canonical and legacy registered regions retain their original IDs', () => {
    const ids = ['park', 'residential']; expectAreas(render(ids, new Set(ids)), ids);
  }],
  ['duplicate array entries produce one full polygon per actual restricted ID', () => expectAreas(render(legacy, ['pond', 'pond', 'residential', 'residential']), legacy)],
  ['all SSR calls preserve their complete original props', () => {
    assert.ok(fingerprints.length > 0);
    for (const { props, before } of fingerprints) assert.equal(fingerprint(props), before);
  }],
];
let passed = 0;
const failures = [];
for (const [name, run] of checks) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`FAIL ${name}: ${error.message}`); }
}
console.log(JSON.stringify({ total: checks.length, passed, failed: failures.length, failures,
  scope: 'Actual production Canvas SSR restricted-area identity/ownership; no reference-image pixel alignment, browser, phase or match acceptance.' }));
if (failures.length) process.exitCode = 1;
