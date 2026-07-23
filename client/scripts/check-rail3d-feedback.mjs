import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/games/rail3d-sim/_lib/rail3dFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const feedback = await import(moduleUrl);
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const sfxSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dPlayPanels.js', import.meta.url), 'utf8');
const mapTabSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dMapTab.js', import.meta.url), 'utf8');
const operationsSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dOperationsTab.js', import.meta.url), 'utf8');
const advancedSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dAdvancedTab.js', import.meta.url), 'utf8');
const analysisSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dAnalysisTab.js', import.meta.url), 'utf8');
const blocksSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dBlocksTab.js', import.meta.url), 'utf8');
const logSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dLogTab.js', import.meta.url), 'utf8');
const scheduleSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dScheduleTab.js', import.meta.url), 'utf8');
const trainsSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dTrainsTab.js', import.meta.url), 'utf8');
const visualSource = await readFile(new URL('../src/app/games/rail3d-sim/_components/Rail3dVisuals.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../src/app/games/rail3d-sim/play/page.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../src/styles/AppShell.css', import.meta.url), 'utf8');

function train(overrides = {}) {
  return {
    id: 'T1',
    phase: 'RUN',
    signalState: 'GO',
    stopReason: null,
    pose: { edgeId: 'E1', headS: 0 },
    actualArriveS: { 0: 0 },
    actualDepartS: { 0: 30 },
    ...overrides,
  };
}

function railState(overrides = {}) {
  return {
    runId: 'rail-a',
    nowS: 60,
    lookaheadBlocks: 1,
    stepSeconds: 30,
    trains: [train(), train({ id: 'T2', actualArriveS: {}, actualDepartS: {} })],
    blocks: [{ id: 'B1', state: 'OCCUPIED' }, { id: 'B2', state: 'FREE' }],
    segmentTokens: [{ segmentId: 'SEG_MAIN', owner: 'T1' }],
    ...overrides,
  };
}

const base = railState();
const transition = (next) => feedback.rail3dFeedbackTransition(base, next);
const cue = (next) => feedback.rail3dFeedbackCue(base, next);

assert.equal(transition(railState({ runId: 'rail-b' })), 'newRun');
assert.equal(cue(railState({ runId: 'rail-b' })), 'start');
assert.equal(cue(railState({ lookaheadBlocks: 2 })), 'signalAdjust');
assert.equal(transition(railState({ stepSeconds: 60 })), 'stepSeconds');

const allDone = railState({
  nowS: 600,
  trains: [train({ phase: 'DONE' }), train({ id: 'T2', phase: 'DONE' })],
});
assert.equal(cue(allDone), 'serviceComplete');
assert.equal(feedback.rail3dFeedbackPresentation(base, allDone).action, 'trophy');

const tokenWait = railState({
  trains: [train(), train({ id: 'T2', signalState: 'STOP', stopReason: { kind: 'TOKEN_WAIT' } })],
});
assert.equal(cue(tokenWait), 'tokenWait');
assert.equal(feedback.rail3dFeedbackPresentation(base, tokenWait).action, 'wait');

const blockConflict = railState({
  trains: [train(), train({ id: 'T2', signalState: 'STOP', stopReason: { kind: 'BLOCKED' }, waitSeconds: 30 })],
});
assert.equal(cue(blockConflict), 'blockConflict');
assert.equal(feedback.rail3dFeedbackPresentation(base, blockConflict).action, 'block-conflict');

const longerBlockConflict = railState({
  nowS: 120,
  trains: [train(), train({ id: 'T2', signalState: 'STOP', stopReason: { kind: 'BLOCKED' }, waitSeconds: 90 })],
});
assert.equal(feedback.rail3dFeedbackTransition(blockConflict, longerBlockConflict), 'delayEscalated');
assert.equal(feedback.rail3dFeedbackCue(blockConflict, longerBlockConflict), 'railDelay');
assert.equal(feedback.rail3dFeedbackPresentation(blockConflict, longerBlockConflict).label, '90s 누적 지연');

const signalStop = railState({ trains: [train(), train({ id: 'T2', signalState: 'STOP' })] });
assert.equal(cue(signalStop), 'signalStop');
assert.equal(feedback.rail3dFeedbackPresentation(base, signalStop).tone, 'danger');

const oneDone = railState({ trains: [train({ phase: 'DONE' }), train({ id: 'T2' })] });
assert.equal(cue(oneDone), 'trainComplete');

const arrived = railState({
  trains: [train({ actualArriveS: { 0: 0, 1: 120 } }), train({ id: 'T2', actualArriveS: {} })],
});
assert.equal(cue(arrived), 'stationArrive');
assert.equal(feedback.rail3dFeedbackPresentation(base, arrived).action, 'station');

const delayedArrivalBase = railState({
  trains: [train({ waitSeconds: 60 }), train({ id: 'T2', actualArriveS: {}, actualDepartS: {} })],
});
const delayedArrival = railState({
  nowS: 120,
  trains: [train({ waitSeconds: 60, actualArriveS: { 0: 0, 1: 120 } }), train({ id: 'T2', actualArriveS: {}, actualDepartS: {} })],
});
assert.equal(feedback.rail3dFeedbackTransition(delayedArrivalBase, delayedArrival), 'delayedArrival');
assert.equal(feedback.rail3dFeedbackCue(delayedArrivalBase, delayedArrival), 'delayedArrival');
assert.equal(feedback.rail3dFeedbackPresentation(delayedArrivalBase, delayedArrival).action, 'rail-delay');

const departed = railState({
  trains: [
    train({ actualDepartS: { 0: 30, 1: 150 } }),
    train({ id: 'T2', actualArriveS: {}, actualDepartS: {} }),
  ],
});
assert.equal(cue(departed), 'trainDepart');

const stoppedBase = railState({ trains: [train({ signalState: 'STOP' }), train({ id: 'T2' })] });
assert.equal(feedback.rail3dFeedbackTransition(stoppedBase, base), 'networkClear');
assert.equal(feedback.rail3dFeedbackCue(stoppedBase, base), 'railNetworkClear');

const twoStopped = railState({
  trains: [train({ signalState: 'STOP' }), train({ id: 'T2', signalState: 'STOP' })],
});
assert.equal(feedback.rail3dFeedbackTransition(twoStopped, stoppedBase), 'signalClear');

const junctionPass = railState({
  trains: [
    train({ pose: { edgeId: 'E2', headS: 10 } }),
    train({ id: 'T2', actualArriveS: {}, actualDepartS: {} }),
  ],
});
assert.equal(transition(junctionPass), 'junctionPass');
assert.equal(cue(junctionPass), 'railJunction');
assert.equal(feedback.rail3dFeedbackPresentation(base, junctionPass).action, 'rail-junction');

const tokenHandoff = railState({
  segmentTokens: [{ segmentId: 'SEG_MAIN', owner: 'T2' }],
});
assert.equal(transition(tokenHandoff), 'tokenHandoff');
assert.equal(cue(tokenHandoff), 'railTokenHandoff');
assert.equal(feedback.rail3dFeedbackPresentation(base, tokenHandoff).action, 'rail-token');
assert.equal(cue(railState({ nowS: 90 })), 'railStep');

assert.equal(feedback.rail3dResultPresentation('저장된 Rail3D 운행을 불러왔습니다.').action, 'load');
assert.equal(feedback.rail3dResultPresentation('Rail3D 운행을 저장했습니다.').action, 'save');
assert.equal(feedback.rail3dResultPresentation('운행 기록을 전적에 남겼습니다.').action, 'archive');
assert.equal(feedback.rail3dResultPresentation('T1 열차를 선택했습니다.').action, 'dispatch');
assert.equal(feedback.rail3dResultPresentation('저장된 진행 상태가 없습니다.').tone, 'warning');

const conflictImpacts = feedback.rail3dFeedbackImpacts(base, blockConflict);
assert.deepEqual(
  conflictImpacts.map((row) => row.label),
  ['블록 충돌', 'STOP', '최장 대기', '도착'],
  '충돌·정지·대기 위험을 도착보다 먼저 표시해야 합니다.',
);
assert.equal(conflictImpacts[0].value, '+1편');
assert.equal(conflictImpacts[0].tone, 'danger');
assert.ok(conflictImpacts.length <= 4, 'Rail3D 변화량은 최대 4칸이어야 합니다.');

const completionImpacts = feedback.rail3dFeedbackImpacts(base, allDone);
assert.deepEqual(
  completionImpacts.map((row) => row.label),
  ['종착', '도착', '출발', '운행 시간'],
  '정상 운행은 종착·도착·출발 성과와 진행 시간을 표시해야 합니다.',
);
assert.equal(completionImpacts[0].value, '+2편');
assert.ok(completionImpacts.slice(0, 3).every((row) => row.tone === 'success'));

const signalImpacts = feedback.rail3dFeedbackImpacts(base, railState({ lookaheadBlocks: 2 }));
assert.deepEqual(signalImpacts, [{ action: 'signal', label: '예약 시야', value: '2블록', tone: 'highlight' }]);
const stepImpacts = feedback.rail3dFeedbackImpacts(base, railState({ nowS: 90 }));
assert.deepEqual(stepImpacts, [{ action: 'clock', label: '운행 시간', value: '+30초', tone: 'highlight' }]);
const junctionImpacts = feedback.rail3dFeedbackImpacts(base, junctionPass);
assert.deepEqual(junctionImpacts, [{ action: 'rail-junction', label: '분기 통과', value: '경로 상태 갱신', tone: 'highlight' }]);
assert.deepEqual(feedback.rail3dFeedbackImpacts(base, railState({ runId: 'rail-b' })), []);

assert.match(iconSource, /'block-conflict':\s*ShieldOff/, '블록 충돌은 전용 아이콘을 사용해야 합니다.');
assert.match(iconSource, /'rail-delay':\s*Timer/, '누적 지연은 타이머 아이콘을 사용해야 합니다.');
assert.match(iconSource, /'rail-clear':\s*BadgeCheck/, '전 구간 정상은 확인 아이콘을 사용해야 합니다.');
assert.match(iconSource, /'rail-junction':\s*Route/, '분기 통과는 노선 아이콘을 사용해야 합니다.');
assert.match(iconSource, /'rail-token':\s*KeyRound/, '토큰 인계는 열쇠 아이콘을 사용해야 합니다.');
const railCueIds = [
  'start',
  'signalAdjust',
  'select',
  'serviceComplete',
  'tokenWait',
  'blockConflict',
  'signalStop',
  'trainComplete',
  'delayedArrival',
  'stationArrive',
  'trainDepart',
  'railNetworkClear',
  'signalClear',
  'railJunction',
  'railTokenHandoff',
  'railDelay',
  'railStep',
];
const railThemeMatch = sfxSource.match(/\n  rail: \{([\s\S]*?)\n  \},\n  ledger: \{/);
assert.ok(railThemeMatch, 'Rail3D 전용 사운드 테마를 찾을 수 있어야 합니다.');
const railThemeSource = railThemeMatch[1];
let layeredRailCueCount = 0;
for (const cueId of railCueIds) {
  const cueMatch = railThemeSource.match(new RegExp(`\\n\\s*${cueId}\\s*:\\s*\\[([\\s\\S]*?)\\n\\s*\\]`));
  assert.ok(cueMatch, `${cueId}가 Rail3D 테마 안에 등록되어야 합니다.`);
  assert.ok((cueMatch[1].match(/\{/g) || []).length >= 3, `${cueId}는 3개 이상의 레이어를 사용해야 합니다.`);
  layeredRailCueCount += 1;
}
const railNoiseLayerCount = (railThemeSource.match(/source: 'noise'/g) || []).length;
const railReverbLayerCount = (railThemeSource.match(/reverb:/g) || []).length;
const railPanLayerCount = (railThemeSource.match(/pan:/g) || []).length;
assert.ok(railNoiseLayerCount >= 17, 'Rail3D 테마는 레일·신호 질감을 위한 노이즈 레이어를 충분히 사용해야 합니다.');
assert.ok(railReverbLayerCount >= 15, 'Rail3D 테마는 역과 선로 공간감을 위한 잔향 레이어를 충분히 사용해야 합니다.');
assert.ok(railPanLayerCount >= 45, 'Rail3D 테마는 좌우 운행감을 위한 스테레오 레이어를 충분히 사용해야 합니다.');
assert.match(panelSource, /블록 충돌/, '운행 결과 문구는 블록 충돌 편수를 표시해야 합니다.');
['TrainFront', 'MapPin', 'RadioTower', 'KeyRound'].forEach((icon) => {
  assert.ok(panelSource.includes(icon), `${icon} 미니맵 오브젝트 아이콘이 필요합니다.`);
});
assert.match(panelSource, /onSelectTrain/, '미니맵에서 열차를 직접 선택할 수 있어야 합니다.');
assert.match(mapTabSource, /rail-map-legend/, '미니맵 오브젝트 범례가 필요합니다.');
assert.match(mapTabSource, /rail-map-selection/, '선택 열차 상태 띠가 필요합니다.');
assert.match(operationsSource, /cue="off"/, '결과음이 있는 운행 버튼은 예비 클릭음을 억제해야 합니다.');
assert.match(advancedSource, /data-game-sfx="off"/, '상태 전환 선택기는 예비 클릭음을 억제해야 합니다.');

const semanticSources = [
  advancedSource,
  analysisSource,
  blocksSource,
  logSource,
  mapTabSource,
  operationsSource,
  scheduleSource,
  trainsSource,
].join('\n');
const semanticPanelTitleCount = (semanticSources.match(/<Rail3dPanelTitle\b/g) || []).length;
const semanticIconRowCount = (semanticSources.match(/<Rail3dIconRow\b/g) || []).length;
assert.equal(semanticPanelTitleCount, 28, 'Rail3D 기능 제목 28곳에 의미 아이콘이 있어야 합니다.');
assert.equal(semanticIconRowCount, 16, 'Rail3D 상태 정보 행 16곳에 의미 아이콘이 있어야 합니다.');
assert.doesNotMatch(semanticSources, /className="games-panel-title"/, 'Rail3D 기능 제목에 원시 제목 마크업이 남아 있으면 안 됩니다.');
assert.doesNotMatch(semanticSources, /className="game-save-row"/, 'Rail3D 상태 정보에 원시 행 마크업이 남아 있으면 안 됩니다.');
assert.match(visualSource, /export function railTrainAction/);
assert.match(visualSource, /export function railSegmentAction/);
assert.match(visualSource, /export function Rail3dPanelTitle/);
assert.match(visualSource, /export function Rail3dIconRow/);
assert.match(visualSource, /export function Rail3dImpactStrip/);
assert.match(visualSource, /aria-label="최근 운행 변화량"/);
assert.match(styleSource, /\.rail3d-panel-title h2/);
assert.match(styleSource, /\.game-save-row\.rail3d-icon-row/);
assert.match(styleSource, /\.rail3d-impact-strip/);
assert.match(styleSource, /\.rail3d-impact-chip\.is-danger/);
assert.match(pageSource, /rail3dFeedbackImpacts\(state, nextState\)/);
assert.match(pageSource, /<Rail3dImpactStrip items=\{resultImpacts\} \/>/);
assert.match(pageSource, /<GameControlButton action="new" cue="off"/);
assert.match(pageSource, /if \(presentation\.cue\) playGameSfx\(presentation\.cue\)/);

for (const action of ['analysis', 'dispatch', 'logs', 'map', 'settings', 'signal', 'station', 'wait']) {
  assert.match(iconSource, new RegExp(`\\n\\s*${action}\\s*:`), `${action} 공통 아이콘이 등록되어 있어야 합니다.`);
}

console.log(JSON.stringify({
  transitions: 17,
  contextualResultIcons: 17,
  impactRows: conflictImpacts.length,
  railThemeCues: layeredRailCueCount,
  railNoiseLayers: railNoiseLayerCount,
  railReverbLayers: railReverbLayerCount,
  railPanLayers: railPanLayerCount,
  mapObjectIcons: 5,
  semanticPanelTitles: semanticPanelTitleCount,
  semanticIconRows: semanticIconRowCount,
  directTrainSelection: true,
}, null, 2));
