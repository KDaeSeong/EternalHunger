import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { LUMIA_MINIMAP_REFERENCE_IMAGE as image, LUMIA_MINIMAP_VIEWBOX as viewBox } from '../src/app/simulation/_lib/simulationConstants.js';
import { LUMIA_REFERENCE_POLYGONS, LUMIA_REFERENCE_LABEL_RECTS } from '../src/app/simulation/_lib/lumiaReferenceMapGeometry.js';
import { LUMIA_REFERENCE_ALERT_COVERAGE_POLYGONS as coverage } from '../src/app/simulation/_components/minimapReferenceAlertCoverage.js';
import { buildCustomMapRenderGeometry } from '../src/app/simulation/_lib/customMapRenderGeometryRuntime.js';

// Actual component SSR checks paint-source/clip/filter ownership. Pixel color,
// rasterization, browser performance and terrain geography need other evidence.
const canvasUrl = new URL('../src/app/simulation/_components/SimulationMinimapCanvas.js', import.meta.url).href;
registerHooks({
  load(url, context, nextLoad) {
    if (url !== canvasUrl) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    }).outputText };
  },
});
const { default: Canvas } = await import(canvasUrl);
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const snapshot = value => JSON.stringify(value, (_, entry) => entry instanceof Set ? { setValues: Array.from(entry) } : entry);
const sourceUrls = [import.meta.url, canvasUrl,
  '../src/app/simulation/_components/minimapReferenceAlertCoverage.js',
  '../src/app/simulation/_lib/lumiaReferenceMapGeometry.js',
  '../src/app/simulation/_lib/customMapRenderGeometryRuntime.js',
  '../public/Images/LumiaIslandMapReference.png',
].map(value => new URL(value, import.meta.url));
const hashes = () => sourceUrls.map(url => ({ file: url.href, sha256: sha(readFileSync(url)) }));
const sourceBefore = hashes(), inputSnapshots = [];
const names = { park: '연못', pond: '연못', apartment: '고급 주택가', residential: '고급 주택가' };
const referenceId = id => ({ pond: 'park', residential: 'apartment' })[id] || id;
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze); return Object.freeze(value);
}
function props(overrides = {}) {
  return freeze({ activeMapId: 'guest-lumia-island', zones: ['park', 'apartment'].map(zoneId => ({ zoneId, name: names[zoneId] })),
    zonePos: {}, zoneEdges: [], survivors: [], dead: [], trackedActorIds: [], recentMoveTrails: [], recentPings: [],
    hyperloopZoneSet: new Set(), forbiddenNow: new Set(['park', 'apartment']), fitViewport: true,
    getZoneName: zoneId => names[zoneId] || zoneId, ...overrides });
}
// Parse only generated tags/attributes; do not run scripts or a substitute DOM.
function parse(html) {
  const root = { tag: '#root', children: [] }, stack = [root], nodes = [];
  const token = /<\/?([A-Za-z][\w:-]*)\b[^>]*>/g;
  for (const match of html.matchAll(token)) {
    const text = match[0], tag = match[1];
    if (text.startsWith('</')) { assert.equal(stack.at(-1).tag, tag); stack.pop(); continue; }
    const attrs = Object.fromEntries(Array.from(text.matchAll(/([\w:-]+)="([^"]*)"/g), m => [m[1], m[2]]));
    const node = { tag, attrs, children: [], parent: stack.at(-1), start: match.index };
    node.parent.children.push(node); nodes.push(node);
    if (!text.endsWith('/>') && !['link', 'img', 'br', 'input', 'meta'].includes(tag)) stack.push(node);
  }
  assert.equal(stack.length, 1); return { root, nodes };
}
const normalized = name => name.toLowerCase().replaceAll('-', '');
const attr = (node, name) => Object.entries(node?.attrs || {}).find(([key]) => normalized(key) === normalized(name))?.[1];
const hasClass = (node, name) => String(attr(node, 'class') || '').split(/\s+/).includes(name);
const children = (node, predicate) => node.children.flatMap(child => [...(predicate(child) ? [child] : []), ...children(child, predicate)]);
function svgOwner(node) { while (node && node.tag !== 'svg') node = node.parent; return node; }
function resolve(svg, value, tag) {
  const id = /^url\(#([^\)]+)\)$/.exec(String(value || ''))?.[1]; assert.ok(id, `Expected local ${tag} URL reference`);
  const matches = children(svg, node => attr(node, 'id') === id);
  assert.equal(matches.length, 1, `The painted image must resolve one owned ${tag}`);
  assert.equal(matches[0].tag, tag); return matches[0];
}
function render(value = props(), fragment = false) {
  const values = fragment ? value : [value];
  for (const item of values) inputSnapshots.push({ item, before: snapshot(item) });
  const element = fragment ? React.createElement(React.Fragment, null, ...values.map((item, index) => React.createElement(Canvas, { ...item, key: index }))) : React.createElement(Canvas, value);
  return parse(renderToStaticMarkup(element));
}
function native(tree, svg = tree.nodes.find(node => node.tag === 'svg')) {
  assert.ok(svg); const images = children(svg, node => node.tag === 'image');
  const base = images.filter(node => hasClass(node, 'minimap-reference-map') && !hasClass(node, 'minimap-restricted-map'));
  const tint = images.filter(node => attr(node, 'data-native-forbidden-image') === 'true');
  assert.equal(base.length, 1); assert.equal(tint.length, 1);
  return { svg, base: base[0], tint: tint[0], clip: resolve(svg, attr(tint[0], 'clip-path'), 'clipPath'),
    filter: resolve(svg, attr(tint[0], 'filter'), 'filter'), mask: resolve(svg, attr(tint[0], 'mask'), 'mask') };
}
function points(node) {
  return String(attr(node, 'points') || '').trim().split(/\s+/).filter(Boolean).map(pair => pair.split(',').map(Number));
}
function expectCoverage(bundle, ids) {
  const polygons = children(bundle.clip, node => node.tag === 'polygon');
  assert.deepEqual(polygons.map(node => attr(node, 'data-zone-id')).sort(), [...ids].sort());
  for (const node of polygons) {
    const id = attr(node, 'data-zone-id'), expected = coverage[referenceId(id)];
    assert.ok(expected, 'Registered raw ID must resolve supported native coverage');
    assert.equal(digest(points(node)), digest(expected), `Painted clip uses generated coverage for ${id}`);
  }
  assert.ok(!bundle.clip.parent || svgOwner(bundle.clip) === bundle.svg);
}
const frameNames = ['x', 'y', 'width', 'height'];
const frame = node => Object.fromEntries(frameNames.map(name => [name, Number(attr(node, name))]));
const numbers = value => String(value || '').trim().split(/\s+/).map(Number);
const checks = [
  ['the actual second image reuses the original PNG, image frame and aspect policy', () => {
    const b = native(render());
    assert.equal(attr(b.base, 'href'), image.src); assert.equal(attr(b.tint, 'href'), attr(b.base, 'href'));
    assert.deepEqual(frame(b.tint), frame(b.base));
    assert.equal(attr(b.base, 'preserveAspectRatio'), 'none'); assert.equal(attr(b.tint, 'preserveAspectRatio'), 'none');
    const sx = viewBox.width / image.mapBounds.width, sy = viewBox.height / image.mapBounds.height;
    assert.deepEqual(frame(b.tint), { x: -image.mapBounds.x * sx, y: -image.mapBounds.y * sy, width: image.sourceSize.width * sx, height: image.sourceSize.height * sy });
  }],
  ['the painted image references the current registered restricted coverage rather than decorative polygons', () => {
    const b = native(render()); expectCoverage(b, ['park', 'apartment']);
    for (const node of children(b.svg, node => node.tag === 'polygon' && hasClass(node, 'forbidden'))) assert.equal(node.parent, b.clip);
    assert.notEqual(digest(points(b.clip.children[0])), digest(LUMIA_REFERENCE_POLYGONS[attr(b.clip.children[0], 'data-zone-id')]));
  }],
  ['all21 canonical raw IDs have exactly one real coverage clip on the same painted image', () => {
    const ids = Object.keys(coverage); assert.equal(ids.length, 21);
    expectCoverage(native(render(props({ zones: ids.map(zoneId => ({ zoneId })), forbiddenNow: new Set(ids) }))), ids);
  }],
  ['filter and all21 label rectangles resolve within the same SVG and image frame', () => {
    const b = native(render()); assert.deepEqual(frame(b.filter), frame(b.tint)); assert.deepEqual(frame(b.mask), frame(b.tint));
    for (const [node, name] of [[b.filter, 'filterUnits'], [b.mask, 'maskUnits'], [b.mask, 'maskContentUnits']]) assert.equal(attr(node, name), 'userSpaceOnUse');
    assert.match(attr(b.mask, 'style'), /mask-type:\s*luminance/);
    const rectangles = children(b.mask, node => node.tag === 'rect'), white = rectangles.filter(node => attr(node, 'fill') === 'white'), black = rectangles.filter(node => attr(node, 'fill') === 'black');
    assert.equal(white.length, 1); assert.deepEqual(frame(white[0]), frame(b.tint)); assert.equal(black.length, 21);
    assert.deepEqual(black.map(frame), LUMIA_REFERENCE_LABEL_RECTS.map(box => ({ x: box.min.x, y: box.min.y, width: box.max.x - box.min.x, height: box.max.y - box.min.y })));
  }],
  ['sRGB contrast and hue alpha gates feed a real AND and final colored-image composite', () => {
    const { filter } = native(render()); assert.equal(attr(filter, 'color-interpolation-filters'), 'sRGB');
    const result = name => { const found = filter.children.filter(node => attr(node, 'result') === name); assert.equal(found.length, 1); return found[0]; };
    for (const [name, alpha] of [['blueContrast', [-1, 0, 1, 0, 0]], ['blueHue', [1, -3, 2, 0, 0]]]) {
      const matrix = result(name); assert.equal(matrix.tag, 'feColorMatrix'); assert.equal(attr(matrix, 'in'), 'SourceGraphic');
      const values = numbers(attr(matrix, 'values')); assert.equal(values.length, 20); assert.deepEqual(values.slice(15), alpha);
    }
    for (const [name, input, intercept] of [['blueContrastMask', 'blueContrast', -24], ['blueHueMask', 'blueHue', 0]]) {
      const transfer = result(name); assert.equal(transfer.tag, 'feComponentTransfer'); assert.equal(attr(transfer, 'in'), input);
      assert.equal(transfer.children.length, 1); const a = transfer.children[0]; assert.equal(a.tag, 'feFuncA');
      assert.equal(attr(a, 'type'), 'linear'); assert.equal(Number(attr(a, 'slope')), 255); assert.equal(Number(attr(a, 'intercept')), intercept);
    }
    const and = result('terrainMask'); assert.equal(and.tag, 'feComposite'); assert.equal(attr(and, 'operator'), 'in');
    assert.equal(attr(and, 'in'), 'blueContrastMask'); assert.equal(attr(and, 'in2'), 'blueHueMask');
    const red = result('redTerrain'); assert.equal(red.tag, 'feColorMatrix'); assert.equal(attr(red, 'in'), 'SourceGraphic');
    assert.deepEqual(numbers(attr(red, 'values')), [0, 0, 1, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
    const final = filter.children.at(-1); assert.equal(final.tag, 'feComposite'); assert.equal(attr(final, 'in'), 'redTerrain'); assert.equal(attr(final, 'in2'), 'terrainMask'); assert.equal(attr(final, 'operator'), 'in');
  }],
  ['none, unknown and unregistered raw restricted IDs paint no tint image', () => {
    for (const [ids, banned] of [[['park'], []], [['park'], new Set()], [['park'], ['unknown']], [['unknown'], ['unknown']], [['park'], ['apartment']], [['park'], ['pond']], [['pond'], ['park']]]) {
      const tree = render(props({ zones: ids.map(zoneId => ({ zoneId })), forbiddenNow: banned }));
      assert.equal(tree.nodes.filter(node => attr(node, 'data-native-forbidden-image') === 'true').length, 0);
    }
  }],
  ['supported aliases keep raw membership IDs while their painted clip uses canonical coverage', () => {
    const ids = ['pond', 'residential'], b = native(render(props({ zones: ids.map(zoneId => ({ zoneId })), forbiddenNow: new Set(ids) })));
    expectCoverage(b, ids);
    assert.equal(children(b.svg, node => node.tag === 'circle' && hasClass(node, 'minimap-zone-surface')).length, 0);
  }],
  ['Set, array and duplicate membership produce the same actual painted clip', () => {
    const get = banned => { const b = native(render(props({ forbiddenNow: banned }))); return b.clip.children.map(node => ({ id: attr(node, 'data-zone-id'), points: points(node) })); };
    assert.deepEqual(get(new Set(['park', 'apartment'])), get(['park', 'apartment']));
    assert.deepEqual(get(['park', 'park', 'apartment']), get(['park', 'apartment']));
  }],
  ['inline and expanded canvases keep the same native-image frame and painted coverage', () => {
    const a = native(render()), b = native(render(props({ expanded: true })));
    assert.deepEqual(frame(a.tint), frame(b.tint)); expectCoverage(a, ['park', 'apartment']); expectCoverage(b, ['park', 'apartment']);
  }],
  ['custom maps retain their original raw geometry, flat restriction polygons and island clip', () => {
    const zones = [{ zoneId: 'pond', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] }, { zoneId: 'residential', polygon: [[20, 0], [30, 0], [30, 10], [20, 10]] }];
    const p = props({ activeMapId: 'local-map-native-terrain-check', zones, forbiddenNow: new Set(['pond', 'residential']) });
    const before = snapshot(p), geometry = buildCustomMapRenderGeometry(p.zones, p.zoneEdges), tree = render(p);
    assert.equal(tree.nodes.filter(node => node.tag === 'image' && hasClass(node, 'minimap-reference-map')).length, 0);
    assert.equal(tree.nodes.filter(node => ['filter', 'mask'].includes(node.tag)).length, 0);
    const group = tree.nodes.find(node => hasClass(node, 'minimap-zone-alert-layer'));
    const clip = resolve(svgOwner(group), attr(group, 'clip-path'), 'clipPath'); assert.equal(clip.children.length, 1);
    assert.deepEqual(points(clip.children[0]), geometry.outline);
    const areas = group.children.filter(node => node.tag === 'polygon'); assert.deepEqual(areas.map(node => attr(node, 'data-zone-id')), ['pond', 'residential']);
    for (const node of areas) {
      const id = attr(node, 'data-zone-id'), center = geometry.positions[id];
      const expected = geometry.polygons[id].map(([x, y]) => [
        Number((center.x + (x - center.x) * 0.82).toFixed(2)),
        Number((center.y + (y - center.y) * 0.82).toFixed(2)),
      ]);
      assert.deepEqual(points(node), expected); assert.notEqual(digest(points(node)), digest(coverage[referenceId(id)]));
    }
    assert.equal(snapshot(p), before);
  }],
  ['native image, tint, trails, dead and living marks paint in order under separate clips', () => {
    const live = { _id: 'live', name: '생존자', hp: 114, maxHp: 146, zoneId: 'park', teamId: 'team:4', teamName: '4팀' };
    const dead = { ...live, _id: 'dead', name: '사망자', hp: 0 };
    const tree = render(props({ survivors: [live], dead: [dead], recentMoveTrails: [{ id: 'trail', from: 'park', to: 'apartment' }] })), b = native(tree);
    const trail = tree.nodes.find(node => hasClass(node, 'minimap-move-trail')), corpse = tree.nodes.find(node => hasClass(node, 'minimap-dead-token')), actor = tree.nodes.find(node => hasClass(node, 'minimap-character-token'));
    assert.ok(trail && corpse && actor); assert.ok(b.base.start < b.tint.start && b.tint.start < trail.start && trail.start < corpse.start && corpse.start < actor.start);
    const nearestClip = node => { while (node && !attr(node, 'clip-path')) node = node.parent; return node ? resolve(b.svg, attr(node, 'clip-path'), 'clipPath') : null; };
    const island = nearestClip(trail); assert.notEqual(attr(island, 'id'), attr(b.clip, 'id'));
    assert.deepEqual(island.children.map(points), Object.values(LUMIA_REFERENCE_POLYGONS));
    assert.notEqual(nearestClip(corpse), b.clip); assert.notEqual(nearestClip(actor), b.clip);
    assert.match(attr(actor, 'aria-label'), /HP 114\/146/); assert.equal(attr(actor, 'data-zone-id'), 'park');
  }],
  ['two simultaneous canvases own disjoint filter, clip and label-mask IDs', () => {
    const tree = render([props(), props({ expanded: true })], true), svgs = tree.nodes.filter(node => node.tag === 'svg');
    assert.equal(svgs.length, 2); const ids = tree.nodes.map(node => attr(node, 'id')).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length); for (const svg of svgs) { const b = native(tree, svg); expectCoverage(b, ['park', 'apartment']); }
  }],
  ['all input state and source/PNG bytes stay unchanged throughout actual SSR', () => {
    for (const { item, before } of inputSnapshots) assert.equal(snapshot(item), before);
    assert.deepEqual(hashes(), sourceBefore);
  }],
];
let passed = 0; const failures = [];
for (const [name, run] of checks) {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { const message = String(error.message).slice(0, 1800); failures.push({ name, message }); console.error(`FAIL ${name}: ${message}`); }
}
console.log(JSON.stringify({ total: checks.length, passed, failed: failures.length, failures,
  scope: 'Actual Canvas SSR image/coverage/filter/mask wiring and ownership only; no raster color, source-terrain pixel accuracy, browser performance or game acceptance.' }));
if (failures.length) process.exitCode = 1;
