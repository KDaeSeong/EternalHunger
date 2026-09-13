import './lib/register-simulation-modules.mjs';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { actor, skill, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
// A loopback-only regression preview of the actual UI component and stylesheet,
// supplied with real engine frames. This is not a production route or a mock UI.
const source = readFileSync(new URL('../src/app/simulation/_components/SimulationTeamObserverPanel.js', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {}; new Function('require', 'exports', output)(createRequire(import.meta.url), exports);
const Panel = exports.default;
const css = readFileSync(new URL('../src/styles/ERSimulation.css', import.meta.url), 'utf8');
const makeRows = (enhanced = false) => [actor('a', { name: '시전 검사자', characterSkills: { q: skill({ name: '시간차 타격', type: enhanced ? 'basic_attack_enhance' : 'attack_skill' }) } }), actor('b', { name: '대상 검사자', _basicAttackReadyAtSec: 200 })];
const cast = await runCombatScenario(makeRows());
const armed = await runCombatScenario(makeRows(true));
const cancelled = await runCombatScenario(makeRows(), { onElapsed: (map, sec) => { if (sec === 1) map.get('b').zoneId = 'remote'; } });
const entries = [
  ['casting', cast, cast.frames.find((frame) => frame.roster[0]._pendingCharacterCast)],
  ['armed', armed, armed.frames.find((frame) => frame.roster[0]._armedCharacterSkill)],
  ['cancelled', cancelled, cancelled.frames.at(-1)],
];
const pages = new Map(entries.map(([label, result, frame]) => {
  assert.ok(frame);
  const model = buildTeamObserverModel({ survivors: frame.roster, events: result.events, teamId: 'a', matchSec: frame.sec });
  const panel = renderToStaticMarkup(React.createElement(Panel, { model, onTeamChange: () => {}, isGameOver: label === 'cancelled' }));
  return [`/${label}`, `<!doctype html><html lang="ko"><meta charset="utf-8"><title>시전 관전 패널 검사 - ${label}</title><style>${css}</style>
    <body style="background:#08131e;margin:20px;color:white;font-family:Arial,sans-serif"><h1 style="font-size:18px">관전 패널 회귀 검사 · 실제 실행기 프레임</h1>
    <nav><a href="/casting">시전 중</a> · <a href="/armed">강화 준비</a> · <a href="/cancelled">취소 기록</a></nav>
    <main style="max-width:450px;margin-top:16px">${panel}</main></body></html>`];
}));
assert.match(pages.get('/casting'), /시간차 타격 시전 중/);
assert.match(pages.get('/armed'), /시간차 타격 강화 준비/);
assert.match(pages.get('/cancelled'), /대상 지역 이탈/);
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(pages.get(request.url) || pages.get('/casting'));
});
server.listen(3116, '127.0.0.1', () => console.log('CASTING_PREVIEW http://127.0.0.1:3116/casting'));
