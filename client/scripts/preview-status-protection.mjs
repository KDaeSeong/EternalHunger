import './lib/register-simulation-modules.mjs';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { actor, effect, runCombatScenario } = await import('./lib/run-combat-scenario.mjs');
const { applyStatusEffect } = await import('../src/app/simulation/_lib/runtimeStatusApplication.js');
const { formatRuntimeEffectResultText } = await import('../src/app/simulation/_lib/runtimeStatusDisplay.js');
const { buildTeamObserverModel } = await import('../src/app/simulation/_lib/teamObserverRuntime.js');
const { runDetonationTickPhase } = await import('../src/app/simulation/_lib/phaseDetonationTickRuntime.js');

// Loopback-only visual regression fixture, not a production route. Render the
// actual survivor component and its real local dependencies, without UI mocks.
const root = fileURLToPath(new URL('../', import.meta.url));
const cache = new Map();
function loadSource(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const require = createRequire(path);
  const localRequire = (specifier) => {
    if (!specifier.startsWith('.')) return require(specifier);
    let target = resolve(dirname(path), specifier);
    if (!extname(target) && existsSync(`${target}.js`)) target += '.js';
    return target.endsWith('.js') ? loadSource(target) : require(specifier);
  };
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports;
}
const Board = loadSource(resolve(root, 'src/app/simulation/_components/SimulationSurvivorBoard.js')).default;
const ObserverPanel = loadSource(resolve(root, 'src/app/simulation/_components/SimulationTeamObserverPanel.js')).default;
const match = await runCombatScenario([
  actor('a', { name: '보호 경계 검사자', activeEffects: [effect('저지 불가', 2), effect('기절', 4)] }),
  actor('b', { name: '상대 검사자', _basicAttackReadyAtSec: 200 }),
], { duration: 4.25 });
const stages = [
  ['protected', '100초 · 보호 중', match.frames.find((frame) => frame.sec === 100).roster],
  ['resumed', '102초 · 남은 기절 재개', match.frames.find((frame) => frame.sec === 102).roster],
  ['expired', '104초 · 기절 만료', match.frames.find((frame) => frame.sec === 104).roster],
  ['permanent', '시간 제한 없는 보호', [actor('permanent', { name: '영구 보호 검사자', activeEffects: [effect('모든 방해 면역', null)] })]],
];
assert.deepEqual(match.times('a'), [100, 101, 104]);
const reduced = applyStatusEffect(actor('reduced', { stats: { ccDurationReduction: 0.5 } }), effect('기절', 4));
const protectedActor = actor('protected', { activeEffects: [effect('모든 방해 면역', 2)] });
const blocked = applyStatusEffect(protectedActor, effect('기절', 4));
const cleansed = applyStatusEffect(actor('cleansed', { activeEffects: [effect('기절', 4)] }), effect('해로운 효과 제거', 0));
const messages = [reduced, blocked, cleansed].map((result) => formatRuntimeEffectResultText(result));
assert.match(messages[0], /지속 시간 4→2초/);
assert.match(messages[1], /면역/);
assert.match(messages[2], /제거: 기절/);
const css = readFileSync(resolve(root, 'src/styles/ERSimulation.css'), 'utf8');
const pages = new Map(stages.map(([key, label, roster]) => {
  const board = renderToStaticMarkup(React.createElement(Board, {
    survivors: roster, dead: [], settings: {}, day: 1, phase: 'morning', timeOfDay: 'day',
    uiModal: 'chars', closeUiModal: () => {},
    forbiddenNow: new Set(), getZoneName: () => '통제 검사 구역', killCounts: {}, zones: [],
  }));
  if (key === 'protected') assert.match(board, /기절 4s · 저지 불가로 무시 중/);
  if (key === 'resumed') { assert.match(board, /기절 2s/); assert.doesNotMatch(board, /무시 중/); }
  if (key === 'expired') assert.doesNotMatch(board, /기절/);
  if (key === 'permanent') assert.doesNotMatch(board, /모든 방해 면역 0s/);
  const content = React.createElement('main', { style: { maxWidth: 1000, margin: '20px auto' } },
    React.createElement('h1', { style: { fontSize: 20 } }, '상태 보호 표시 검사 · 실제 실행기 / 실제 생존자 카드'),
    React.createElement('p', null, '일반 경기 완주 검증과 별개의 통제된 시각 검사입니다.'),
    React.createElement('nav', null, stages.map(([target, title]) => React.createElement('a', {
      key: target, href: `/${target}`, style: { color: '#a5d8ff', marginRight: 20 },
    }, title))),
    React.createElement('h2', { style: { fontSize: 18 } }, label),
    React.createElement('ul', null, messages.map((text, index) => React.createElement('li', { key: index }, text))),
    React.createElement('div', { dangerouslySetInnerHTML: { __html: board } }));
  return [`/${key}`, `<!doctype html><html lang="ko"><meta charset="utf-8"><title>상태 보호 표시 검사 - ${key}</title><style>${css}</style><body style="background:#08131e;color:white;font-family:Arial,sans-serif">${renderToStaticMarkup(content)}</body></html>`];
}));
const controlStages = [
  ['fear', '공포', 100.75, false], ['charm', '매혹', 100.75, false],
  ['taunt', '도발', 101.25, false], ['rooted', '도발', 100.75, true], ['control-expired', '매혹', 102, false],
];
for (const [key, name, atSec, rooted] of controlStages) {
  const target = actor('controlled', { name: '강제 행동 검사자',
    _spatial: { zoneId: 'zone', x: 8, y: 4 },
    stats: { maxHp: 1000, attackPower: 1, attackSpeed: 1, attackRange: 1, sightRange: 24, moveSpeed: 3.5 } });
  const caster = actor('caster', { name: '상대 시전자', _actionReadyAtSec: 1e9,
    _spatial: { zoneId: 'zone', x: name === '도발' ? 8.5 : 16, y: 4 } });
  applyStatusEffect(target, effect(name, 2), { sourceActor: caster });
  if (rooted) applyStatusEffect(target, effect('속박', 2));
  const result = await runCombatScenario([target, caster], { duration: 2.25, engage: false });
  const frame = result.frames.findLast((row) => row.sec <= atSec);
  const model = buildTeamObserverModel({ survivors: frame.roster, events: result.events, matchSec: frame.sec,
    teamId: 'controlled', zoneName: () => '통제 검사 구역' });
  const panel = renderToStaticMarkup(React.createElement(ObserverPanel, { model, onTeamChange: () => {}, isGameOver: false }));
  if (key === 'control-expired') assert.doesNotMatch(model.members[0].motion, /매혹/);
  else assert.match(model.members[0].motion, new RegExp(name));
  if (rooted) assert.match(panel, /이동 불가.*사거리 안에서만 기본 공격/);
  if (name === '도발') assert.ok(result.times('controlled').length > 0);
  const content = React.createElement('main', { style: { maxWidth: 800, margin: '20px auto', padding: 16 } },
    React.createElement('h1', { style: { fontSize: 20 } }, `${frame.sec}초 · ${name}${rooted ? ' + 속박' : ''} 관전 검사`),
    React.createElement('p', null, '실제 전투 실행기의 통제 프레임과 실제 팀 관전창입니다. 기본 경기의 밸런스·재미 검사와 별개입니다.'),
    React.createElement('nav', null, controlStages.map(([path, title]) => React.createElement('a', {
      key: path, href: `/${path}`, style: { color: '#a5d8ff', marginRight: 16 },
    }, path === 'rooted' ? '도발 + 속박' : path === 'control-expired' ? '효과 종료' : title))),
    React.createElement('div', { style: { marginTop: 16 }, dangerouslySetInnerHTML: { __html: panel } }));
  pages.set(`/${key}`, `<!doctype html><html lang="ko"><meta charset="utf-8"><title>강제 행동 표시 검사 - ${key}</title><style>${css}</style><body style="background:#08131e;color:white;font-family:Arial,sans-serif">${renderToStaticMarkup(content)}</body></html>`);
}
for (const [key, stateName, atSec] of [['sleep', '수면', 100], ['sleep-woken', '수면', 100.25],
  ['polymorph', '변이', 101], ['suppression', '제압', 101], ['stasis', '경직', 101], ['stasis-ended', '경직', 102.25]]) {
  const rows = [actor('state-target', { name: `${stateName} 검사자`, detonationSec: 10, gadgetEnergy: 0,
    _spatialMotion: { zoneId: 'zone', x: 20, y: 4, stopRange: 0, reason: 'approach' }, activeEffects: [effect(stateName, 2)] }),
  actor('state-enemy', { name: '상대 검사자', detonationSec: 30, gadgetEnergy: 0,
    _basicAttackReadyAtSec: stateName === '수면' ? 100.25 : 1e9,
    _actionReadyAtSec: stateName === '수면' ? 0 : 1e9,
    stats: { attackPower: 100, defense: 0, attackSpeed: 1, sightRange: 24 },
    _spatial: { zoneId: 'zone', x: stateName === '수면' ? 4 : 12, y: 4 } })];
  let previous = structuredClone(rows); let elapsedBefore = 0;
  const result = await runCombatScenario(rows, { duration: 2.25, onElapsed: (live, elapsed) => {
    const next = runDetonationTickPhase({ state: { updatedSurvivors: [...live.values()], intervalStartActors: previous,
      useDetonation: true, forbiddenIds: new Set(['zone']), phaseStartSec: 100 + elapsedBefore,
      phaseDurationSec: elapsed - elapsedBefore, tickSec: 0.25, ruleset: {} } });
    next.updatedSurvivors.forEach((row) => live.set(row._id, row));
    previous = structuredClone([...live.values()]); elapsedBefore = elapsed;
  } });
  const frame = result.frames.findLast((row) => row.sec <= atSec);
  const model = buildTeamObserverModel({ survivors: frame.roster, events: result.events, matchSec: frame.sec,
    teamId: 'state-target', zoneName: () => '통제 금지구역' });
  const board = renderToStaticMarkup(React.createElement(Board, { survivors: frame.roster, dead: [], settings: {}, day: 1,
    phase: 'morning', timeOfDay: 'day', uiModal: 'chars', closeUiModal: () => {},
    forbiddenNow: new Set(['zone']), getZoneName: () => '통제 금지구역', killCounts: {}, zones: [] }));
  const panel = renderToStaticMarkup(React.createElement(ObserverPanel, { model, onTeamChange: () => {}, isGameOver: false }));
  if (key === 'polymorph') assert.match(board, /변이 중 · 양 모습/);
  if (key === 'stasis') { assert.match(board, /금지구역 카운트 정지/); assert.equal(frame.roster[0].detonationSec, 10); }
  if (key === 'stasis-ended') { assert.doesNotMatch(board, /금지구역 카운트 정지/); assert.equal(frame.roster[0].detonationSec, 9.75); }
  if (key === 'sleep-woken') assert.match(panel, /피격되어 수면 해제/);
  const renderFrame = (showBoard) => `<!doctype html><html lang="ko"><meta charset="utf-8"><title>행동 상태 표시 검사 - ${key}</title><style>${css}</style><body style="background:#08131e;color:white;font-family:Arial,sans-serif"><main style="max-width:900px;margin:20px auto"><h1>${frame.sec}초 · ${stateName} 실제 상태 검사</h1><p>실제 실행기·금지구역 시계·관전창·생존자 카드의 통제 검사. 원작 외형 복제나 기본 밸런스 검사가 아닙니다.</p>${panel}${showBoard ? board : ''}</main></body></html>`;
  pages.set(`/${key}`, renderFrame(true));
  pages.set(`/${key}-observer`, renderFrame(false));
}
const imagePath = resolve(root, 'public/Images/default_image.svg');
const server = createServer((request, response) => {
  if (request.url === '/Images/default_image.svg') {
    response.setHeader('Content-Type', 'image/svg+xml'); response.end(readFileSync(imagePath)); return;
  }
  const page = pages.get(request.url);
  response.statusCode = page ? 200 : 404;
  response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(page || 'Not found');
});
server.listen(3117, '127.0.0.1', () => console.log('STATUS_PROTECTION_PREVIEW http://127.0.0.1:3117/protected'));
