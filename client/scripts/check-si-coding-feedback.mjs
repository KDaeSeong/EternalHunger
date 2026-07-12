import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/games/si-coding-sim/_lib/siCodingSimFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const feedback = await import(moduleUrl);

function codingState(overrides = {}) {
  return {
    runId: 'coding-a',
    taskSet: { id: 'pack-a' },
    taskOutcomes: {},
    projectEvaluations: [],
    hintUsage: {},
    companySupport: { totalSpent: 0 },
    ...overrides,
  };
}

function outcome(score, submittedAt = '2026-07-12T00:00:00.000Z') {
  return { score, submittedAt };
}

const base = codingState();
const transition = (next) => feedback.siCodingFeedbackTransition(base, next);
const cue = (next) => feedback.siCodingFeedbackCue(base, next);

assert.equal(transition(codingState({ runId: 'coding-b' })), 'newRun');
assert.equal(cue(codingState({ runId: 'coding-b' })), 'start');
assert.equal(cue(codingState({ taskSet: { id: 'pack-b' } })), 'deploy');

const approved = codingState({ projectEvaluations: [{ createdAt: '2026-07-12T01:00:00.000Z', grade: 'A' }] });
assert.equal(cue(approved), 'projectApproved');
assert.equal(feedback.siCodingFeedbackPresentation(base, approved).label, '프로젝트 A등급 승인');

const rejected = codingState({ projectEvaluations: [{ createdAt: '2026-07-12T01:00:00.000Z', grade: 'FAIL' }] });
assert.equal(cue(rejected), 'projectRejected');
assert.equal(feedback.siCodingFeedbackPresentation(base, rejected).tone, 'danger');

const held = codingState({ projectEvaluations: [{ createdAt: '2026-07-12T01:00:00.000Z', grade: '보류' }] });
assert.equal(feedback.siCodingFeedbackPresentation(base, held).label, '프로젝트 보류');
assert.equal(feedback.siCodingFeedbackPresentation(base, held).tone, 'warning');

const perfect = codingState({ taskOutcomes: { T1: outcome(100) } });
assert.equal(cue(perfect), 'codePerfect');
assert.equal(feedback.siCodingFeedbackPresentation(base, perfect).action, 'trophy');

const passed = codingState({ taskOutcomes: { T1: outcome(84) } });
assert.equal(cue(passed), 'codePass');
assert.equal(feedback.siCodingFeedbackPresentation(base, passed).label, '84점 검수 통과');

const failed = codingState({ taskOutcomes: { T1: outcome(42) } });
assert.equal(cue(failed), 'codeFail');
assert.equal(feedback.siCodingFeedbackPresentation(base, failed).tone, 'danger');

assert.equal(cue(codingState({ hintUsage: { T1: 1 } })), 'hintOpen');
assert.equal(feedback.siCodingFeedbackPresentation(base, codingState({ hintUsage: { T1: 1 } })).action, 'hint');
assert.equal(cue(codingState({ companySupport: { totalSpent: 18 } })), 'support');
assert.equal(feedback.siCodingFeedbackPresentation(base, codingState({ companySupport: { totalSpent: 18 } })).action, 'support');

assert.equal(feedback.siCodingResultPresentation('저장된 현장을 불러왔습니다.').action, 'load');
assert.equal(feedback.siCodingResultPresentation('SI Coding Sim 진행 상태를 저장했습니다.').action, 'save');
assert.equal(feedback.siCodingResultPresentation('납품 기록을 전적에 남겼습니다.').action, 'archive');
assert.equal(feedback.siCodingResultPresentation('현재 과제를 초기화했습니다.').action, 'reset');
assert.equal(feedback.siCodingResultPresentation('회사 지원 예비비가 부족합니다.').tone, 'warning');

console.log(JSON.stringify({
  transitions: 9,
  contextualResultIcons: 9,
  persistenceMessages: true,
}, null, 2));
