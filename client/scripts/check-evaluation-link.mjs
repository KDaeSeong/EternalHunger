import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cleanEvaluationRequestHeaders,
  cleanEvaluationResponseHeaders,
  isAllowedEvaluationRequest,
} from './evaluation-link-proxy.mjs';

assert.equal(isAllowedEvaluationRequest('GET', '/eternalhunger/evaluate'), true);
assert.equal(isAllowedEvaluationRequest('HEAD', '/eternalhunger/evaluate?_rsc=test'), true);
for (const path of ['/_next/static/chunk.js', '/Images/default_image.svg', '/audio/test.ogg', '/games/test.png']) {
  assert.equal(isAllowedEvaluationRequest('GET', path), true, `${path} 평가 자산은 통과해야 합니다.`);
}
for (const path of ['/', '/account', '/admin', '/api/characters', '/board']) {
  assert.equal(isAllowedEvaluationRequest('GET', path), false, `${path} 일반 사이트 경로는 차단해야 합니다.`);
}
assert.equal(isAllowedEvaluationRequest('POST', '/eternalhunger/evaluate'), false, '평가 공개 게이트는 쓰기 요청을 전달하면 안 됩니다.');

const requestHeaders = cleanEvaluationRequestHeaders({
  host: 'public.example',
  cookie: 'session=secret',
  authorization: 'Bearer secret',
  'x-csrf-token': 'secret',
  accept: 'text/html',
});
assert.equal(requestHeaders.cookie, undefined);
assert.equal(requestHeaders.authorization, undefined);
assert.equal(requestHeaders['x-csrf-token'], undefined);
assert.equal(requestHeaders.accept, 'text/html');
const responseHeaders = cleanEvaluationResponseHeaders({ 'set-cookie': ['session=secret'], 'content-type': 'text/html' });
assert.equal(responseHeaders['set-cookie'], undefined);
assert.match(responseHeaders['x-robots-tag'], /noindex/);

const routeSource = readFileSync(new URL('../src/app/eternalhunger/evaluate/page.js', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../src/app/simulation/_lib/useSimulationPageController.js', import.meta.url), 'utf8');
const initialDataSource = readFileSync(new URL('../src/app/simulation/_lib/useSimulationInitialData.js', import.meta.url), 'utf8');
const headerSource = readFileSync(new URL('../src/app/simulation/_components/SimulationScreenHeader.js', import.meta.url), 'utf8');
const replayHistorySource = readFileSync(new URL('../src/app/simulation/_components/SimulationReplayHistory.js', import.meta.url), 'utf8');
const controlPanelSource = readFileSync(new URL('../src/app/simulation/_components/SimulationControlPanel.js', import.meta.url), 'utf8');
const mainStageSource = readFileSync(new URL('../src/app/simulation/_components/SimulationMainStage.js', import.meta.url), 'utf8');
const pageViewSource = readFileSync(new URL('../src/app/simulation/_components/SimulationPageView.js', import.meta.url), 'utf8');
const tutorialSource = readFileSync(new URL('../src/app/games/_components/GameTutorialLauncher.js', import.meta.url), 'utf8');

assert.match(routeSource, /evaluationMode/);
assert.match(routeSource, /EH-G5\.3-20260913-A/);
assert.match(routeSource, /1789192220412/);
assert.match(controllerSource, /evaluationMode\s*\|\|\s*isGuestSimulationSession/);
assert.match(controllerSource, /isolatedEvaluation:\s*evaluationMode\s*&&\s*!sourceRecord/);
assert.match(initialDataSource, /withSimulationRandom\(createSeedRng\(`EVALUATION_SETUP:/);
assert.match(headerSource, /!evaluationMode\s*\?\s*<button[\s\S]*sim-devtools-btn/);
assert.match(replayHistorySource, /결과 JSON 복사/);
assert.match(replayHistorySource, /serializeSimulationEvaluationExport/);
assert.match(controlPanelSource, /evaluationMode\s*&&\s*!draftMode[\s\S]*return '평가 시작'/,
  '기준 평가 경기는 일반 게임 시작과 구분된 단일 시작 문구를 제공해야 합니다.');
assert.match(controlPanelSource, /!isEvaluationStart\s*\?\s*<button[\s\S]*오토 정지/,
  '평가 시작 전에는 별도 오토 버튼을 함께 노출하면 안 됩니다.');
assert.match(mainStageSource, /evaluationMode\s*&&\s*!draftMode\s*&&\s*day\s*===\s*0[\s\S]*setAutoPlay\(true\)/,
  '평가 시작 한 번으로 x32 자동 관전을 시작해야 합니다.');
assert.match(pageViewSource, /평가 시작 한 번 · x32 자동 관전/);
assert.match(tutorialSource, /evaluationOnly/);

console.log('EVALUATION_LINK_CHECK_OK route=1 guest=1 fixedSetup=1 export=1 gate=1');
