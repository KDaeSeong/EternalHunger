import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, createRequire } from 'node:module';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const modalUrl = new URL('../src/app/characters/_components/CharacterAutoSetupModal.js', import.meta.url).href;
registerHooks({ load(url, context, nextLoad) {
  if (url !== modalUrl) return nextLoad(url, context);
  return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
  }).outputText };
} });
const { default: Modal } = await import(modalUrl);
const { createBlankCharacter } = await import('../src/app/characters/_lib/characterEditorRuntime.js');
let applied = 0, requested = 0, passed = 0;
const render = character => renderToStaticMarkup(React.createElement(Modal, {
  character, onClose() {}, onApply() { applied++; }, request() { requested++; },
}));
const html = render(createBlankCharacter('ui-fixture'));
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
check('actual modal exposes a labelled dialog, both input modes and a bounded form', () => {
  assert.match(html, /role="dialog"/); assert.match(html, /aria-labelledby="character-setup-title"/);
  assert.match(html, /이터널 리턴 실험체/); assert.match(html, /커스텀·다른 작품/);
  assert.match(html, /maxLength="40"/); assert.match(html, /maxLength="12000"/);
});
check('blank input cannot generate or apply, and rendering has no request/save side effects', () => {
  assert.match(html, /type="submit"[^>]*disabled/); assert.match(html, /disabled=""[^>]*>확인한 초안 적용/);
  assert.equal(applied, 0); assert.equal(requested, 0);
});
check('known ER name selects the source-backed mode and retains explicit approximation boundaries', () => {
  const erHtml = render({ ...createBlankCharacter('er-fixture'), name: '헤이즈' });
  assert.match(erHtml, /value="er" selected/); assert.match(erHtml, /공식 홈페이지에서 안내한 캐릭터 DB/);
  assert.match(erHtml, /기존 캐릭터나 서버 저장값은 바뀌지 않습니다/);
});
console.log(`Character automatic setup UI checks passed: ${passed}`);

if (process.argv.includes('--preview')) {
  const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const require = createRequire(import.meta.url), bundledWebpack = require('next/dist/compiled/webpack/webpack');
  const compiler = bundledWebpack.webpack({ mode: 'development', target: 'web', devtool: false, cache: false,
    entry: resolve(root, 'scripts/lib/character-setup-preview-entry.js'),
    output: { path: resolve(root, '.next/setup-preview-memory'), filename: 'fixture.js' },
    resolve: { extensions: ['.js', '.json'], modules: [resolve(root, 'node_modules'), 'node_modules'] },
    module: { rules: [{ test: /\.js$/, resolve: { fullySpecified: false } },
      { test: /\.js$/, include: [resolve(root, 'src'), resolve(root, 'scripts/lib/character-setup-preview-entry.js')],
      use: resolve(root, 'scripts/lib/character-setup-preview-loader.cjs') }] },
    plugins: [new bundledWebpack.webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_API_BASE': JSON.stringify('/fixture-no-api') })],
  });
  const files = new Map();
  compiler.outputFileSystem = { mkdir(path, callback) { callback(); },
    writeFile(path, data, callback) { files.set(path, data); callback(); },
    stat(path, callback) { callback(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })); },
    readFile(path, callback) { files.has(path) ? callback(null, files.get(path))
      : callback(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })); }, join: resolve };
  await new Promise((done, reject) => compiler.run((error, stats) => {
    const failure = error || (stats.hasErrors() ? new Error(stats.toString({ all: false, errors: true })) : null);
    compiler.close(closeError => failure || closeError ? reject(failure || closeError) : done());
  }));
  const bundle = files.get(resolve(root, '.next/setup-preview-memory/fixture.js'));
  assert.ok(bundle); // No compiled fixture file is written to disk.
  const staticRoot = resolve(root, '.next/static');
  const page = readFileSync(resolve(root, '.next/server/app/characters.html'), 'utf8');
  const cssLinks = [...new Set([...page.matchAll(/href="(\/_next\/static\/css\/[^"?]+\.css)"/g)].map(match => match[1]))];
  assert.ok(cssLinks.length, 'Build current production CSS before previewing.');
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1:3119').pathname;
    if (path === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundle); return; }
    if (path.startsWith('/_next/static/')) {
      const file = resolve(staticRoot, decodeURIComponent(path.slice('/_next/static/'.length)));
      if (!file.startsWith(staticRoot + sep)) { response.writeHead(403).end(); return; }
      try { response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'font/woff2'); response.end(readFileSync(file)); }
      catch { response.writeHead(404).end(); } return;
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>자동 설정 로컬 확인</title>${cssLinks.map(href => `<link rel="stylesheet" href="${href}">`).join('')}</head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  });
  server.listen(3119, '127.0.0.1', () => console.log(`CHARACTER_SETUP_PREVIEW http://127.0.0.1:3119/ bytes=${bundle.length} (RAM only; no AI/API/save)`));
}
