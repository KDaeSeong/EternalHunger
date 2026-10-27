import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import './lib/register-simulation-modules.mjs';
import { GAMEPLAY_PERK_CODES as CODES } from '../src/utils/gameplayPerks.js';

const { createNewState, normalizeState } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveEngine.js');
const { archiveShopPerkRows, initialArchiveShopPerks, prepareArchiveShopRun } = await import('../src/app/games/primitive-archive/_lib/primitiveArchiveShopPerks.js');

const componentUrl = new URL('../src/app/games/primitive-archive/_components/PrimitiveArchiveShopPerks.js', import.meta.url).href;
globalThis.__archiveShopReact = React;
const linkStub = `data:text/javascript,${encodeURIComponent('export default function Link(props) { return globalThis.__archiveShopReact.createElement("a", props); }')}`;
registerHooks({
  load(url, context, nextLoad) {
    if (url !== componentUrl) return nextLoad(url, context);
    const source = readFileSync(new URL(url), 'utf8').replace("from 'next/link'", `from '${linkStub}'`);
    return { shortCircuit: true, format: 'module', source: ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext }, fileName: 'PrimitiveArchiveShopPerks.jsx',
    }).outputText };
  },
});
const { default: ShopPanel } = await import(componentUrl);
const now = '2026-10-27T00:00:00.000Z';
const source = createNewState({ now, runId: 'source-run', rng: () => 0.5 });
const original = JSON.stringify(source);
let captures = 0;
const start = (extra = {}) => prepareArchiveShopRun({
  source,
  getCurrent: () => source,
  captureCodes: async () => { captures += 1; return [CODES.CAREFUL_GATHER, CODES.RESEARCH_NOTES]; },
  sessionIsCurrent: () => true,
  options: { runId: 'new-run', now, rng: () => 0.5 },
  ...extra,
});
const next = await start();
assert.equal(captures, 1);
assert.equal(next.runId, 'new-run');
assert.deepEqual(next.shopPerks.codes, [CODES.CAREFUL_GATHER, CODES.RESEARCH_NOTES]);
assert.deepEqual(next.shopPerks.uses, { carefulGather: 0, researchNotes: 0 });
assert.equal(JSON.stringify(source), original, 'Starting a new run must not mutate the previous run.');

const without = await start({ captureCodes: async () => [] });
assert.deepEqual(without.shopPerks.codes, []);
await assert.rejects(start({ captureCodes: async () => { throw new Error('offline'); } }), /offline/);
await assert.rejects(start({ getCurrent: () => ({ ...source }) }), { code: 'ARCHIVE_START_CHANGED' });
await assert.rejects(start({ sessionIsCurrent: () => false }), { code: 'ARCHIVE_START_CHANGED' });
let resolveCodes;
const pending = start({ captureCodes: () => new Promise((resolve) => { resolveCodes = resolve; }), getCurrent: () => next });
resolveCodes([CODES.CAREFUL_GATHER]);
await assert.rejects(pending, { code: 'ARCHIVE_START_CHANGED' });

const initial = initialArchiveShopPerks(source, [CODES.CAREFUL_GATHER, CODES.START_SPONSOR]);
assert.equal(initial.runId, source.runId, 'First-run entitlement capture preserves the initial world and run identity.');
assert.equal(initial.party, source.party);
assert.deepEqual(initial.shopPerks.codes, [CODES.CAREFUL_GATHER]);
const spent = normalizeState({ ...next, shopPerks: { ...next.shopPerks, uses: { carefulGather: 2, researchNotes: 7 } } });
assert.deepEqual(archiveShopPerkRows(JSON.parse(JSON.stringify(spent))).map((row) => row.remaining), [1, 3]);
assert.deepEqual(archiveShopPerkRows({ ...spent, shopPerks: { ...spent.shopPerks, uses: {} } }).map((row) => row.remaining), [0, 0]);

const context = { status: 'ready', equippedCodes: [CODES.RESEARCH_NOTES] };
const compact = renderToStaticMarkup(React.createElement(ShopPanel, { state: spent, compact: true }));
assert.match(compact, /꼼꼼한 채집/);
assert.match(compact, /1\/3회 남음/);
assert.match(compact, /3\/10회 남음/);
const setup = renderToStaticMarkup(React.createElement(ShopPanel, { state: spent, context, withoutPerks: false }));
assert.match(setup, /특전 상점 · 장착 관리/);
assert.match(setup, /최대 3개/);
assert.match(setup, /장착 변경은 새 런부터/);
assert.match(renderToStaticMarkup(React.createElement(ShopPanel, { state: source, context: { status: 'error', equippedCodes: [] } })), /특전 정보 다시 확인/);
assert.match(renderToStaticMarkup(React.createElement(ShopPanel, { state: spent, context, withoutPerks: true })), /특전 없이 시작/);
assert.equal(renderToStaticMarkup(React.createElement(ShopPanel, { state: source, compact: true })), '');
console.log('PASS archive shop start: fresh capture, explicit no-perk, failure/race guards, prior-run preservation, persisted counters, current/next UI');
