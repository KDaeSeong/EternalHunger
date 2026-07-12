import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/games/rail3d-sim/_lib/rail3dFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const feedback = await import(moduleUrl);

function train(overrides = {}) {
  return {
    id: 'T1',
    phase: 'RUN',
    signalState: 'GO',
    stopReason: null,
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

const departed = railState({
  trains: [
    train({ actualDepartS: { 0: 30, 1: 150 } }),
    train({ id: 'T2', actualArriveS: {}, actualDepartS: {} }),
  ],
});
assert.equal(cue(departed), 'trainDepart');

const stoppedBase = railState({ trains: [train({ signalState: 'STOP' }), train({ id: 'T2' })] });
assert.equal(feedback.rail3dFeedbackCue(stoppedBase, base), 'signalClear');
assert.equal(cue(railState({ nowS: 90 })), 'railStep');

assert.equal(feedback.rail3dResultPresentation('저장된 Rail3D 운행을 불러왔습니다.').action, 'load');
assert.equal(feedback.rail3dResultPresentation('Rail3D 운행을 저장했습니다.').action, 'save');
assert.equal(feedback.rail3dResultPresentation('운행 기록을 전적에 남겼습니다.').action, 'archive');
assert.equal(feedback.rail3dResultPresentation('T1 열차를 선택했습니다.').action, 'dispatch');
assert.equal(feedback.rail3dResultPresentation('저장된 진행 상태가 없습니다.').tone, 'warning');

console.log(JSON.stringify({
  transitions: 11,
  contextualResultIcons: 11,
  stationIcon: true,
}, null, 2));
