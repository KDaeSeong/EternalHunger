import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/games/si-coding-sim/_lib/siCodingSimFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const feedback = await import(moduleUrl);
const iconSource = await readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8');
const sfxSource = await readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../src/app/games/si-coding-sim/play/page.js', import.meta.url), 'utf8');
const componentRootUrl = new URL('../src/app/games/si-coding-sim/_components/', import.meta.url);
const componentFiles = [
  'SiCodingSubmissionReadinessPanel.js',
  'SiCodingFieldTab.js',
  'SiCodingTasksTab.js',
  'SiCodingCodeTab.js',
  'SiCodingDocsTab.js',
  'SiCodingCareerTab.js',
  'SiCodingAuditTab.js',
  'SiCodingAdvancedTab.js',
  'SiCodingVisuals.js',
];
const componentSources = await Promise.all(componentFiles.map((file) => readFile(new URL(file, componentRootUrl), 'utf8')));
const componentSource = componentSources.join('\n');

function codingState(overrides = {}) {
  return {
    runId: 'coding-a',
    taskSet: { id: 'pack-a' },
    currentTaskId: 'T1',
    selectedSeedId: '',
    taskOutcomes: {},
    projectEvaluations: [],
    hintUsage: {},
    documentReviewByTask: {},
    companySupport: { totalSpent: 0, entries: [] },
    log: ['현장 대기'],
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
assert.equal(cue(held), 'projectHeld');
assert.equal(feedback.siCodingFeedbackPresentation(base, held).action, 'project-held');
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

const selectedTask = codingState({ currentTaskId: 'T2', log: ['T2 과제를 열었습니다.'] });
assert.equal(cue(selectedTask), 'taskSelect');
assert.equal(feedback.siCodingFeedbackPresentation(base, selectedTask).action, 'task-select');
assert.match(feedback.siCodingFeedbackPresentation(base, selectedTask).detail, /T2 과제를 열었습니다/);

const resetTask = codingState({ log: ['T1 작업 파일을 원본 상태로 되돌렸습니다.'] });
assert.equal(cue(resetTask), 'taskReset');
assert.equal(feedback.siCodingFeedbackPresentation(base, resetTask).action, 'reset');

const reviewed = codingState({ documentReviewByTask: { T1: ['DOC-1'] } });
assert.equal(cue(reviewed), 'documentReview');
assert.equal(feedback.siCodingFeedbackPresentation(base, reviewed).label, '문서 검토 1개');
assert.equal(feedback.siCodingFeedbackTransition(reviewed, base), 'documentReviewUndo');
assert.equal(feedback.siCodingFeedbackCue(reviewed, base), 'documentReviewUndo');

assert.equal(cue(codingState({ hintUsage: { T1: 1 } })), 'hintOpen');
assert.equal(feedback.siCodingFeedbackPresentation(base, codingState({ hintUsage: { T1: 1 } })).action, 'hint');
const hintSupport = codingState({ companySupport: { totalSpent: 18, entries: [{ id: 'SUP-1', action: 'hint', title: '힌트 비용 보전', amount: 18 }] } });
assert.equal(cue(hintSupport), 'supportHint');
assert.equal(feedback.siCodingFeedbackPresentation(base, hintSupport).action, 'support-hint');
const riskSupport = codingState({ companySupport: { totalSpent: 24, entries: [{ id: 'SUP-2', action: 'risk', title: 'QA 리스크 완충', amount: 24 }] } });
assert.equal(cue(riskSupport), 'supportRisk');
assert.equal(feedback.siCodingFeedbackPresentation(base, riskSupport).action, 'support-risk');

const selectedProject = codingState({ selectedSeedId: 'SEED-1', log: ['차기 현장 후보 [개편 프로젝트]을 선택했습니다.'] });
assert.equal(cue(selectedProject), 'projectSelect');
assert.equal(feedback.siCodingFeedbackPresentation(base, selectedProject).action, 'project-select');

const blocked = codingState({ log: ['회사 지원 예비비가 부족합니다. 필요 24pt, 보유 0pt.'] });
assert.equal(cue(blocked), 'codingBlocked');
assert.equal(feedback.siCodingFeedbackPresentation(base, blocked).action, 'coding-blocked');
assert.match(feedback.siCodingFeedbackPresentation(base, blocked).detail, /예비비가 부족/);
assert.equal(
  feedback.siCodingResultPresentation(blocked.log[0], feedback.siCodingFeedbackPresentation(base, blocked)).action,
  'coding-blocked',
  '작업 불가 전용 결과는 일반 경고 문구 규칙보다 우선해야 합니다.',
);

assert.equal(feedback.siCodingResultPresentation('저장된 현장을 불러왔습니다.').action, 'load');
assert.equal(feedback.siCodingResultPresentation('SI Coding Sim 진행 상태를 저장했습니다.').action, 'save');
assert.equal(feedback.siCodingResultPresentation('납품 기록을 전적에 남겼습니다.').action, 'archive');
assert.equal(feedback.siCodingResultPresentation('현재 과제를 초기화했습니다.').action, 'reset');
assert.equal(feedback.siCodingResultPresentation('회사 지원 예비비가 부족합니다.').tone, 'warning');

['task-select', 'document-review', 'document-unreview', 'support-hint', 'support-risk', 'project-select', 'project-held', 'coding-audit', 'coding-blocked', 'coding-file', 'coding-ready', 'coding-submit', 'coding-test-fail', 'coding-test-pass'].forEach((key) => {
  assert.ok(iconSource.includes(`'${key}':`), `${key} 전용 아이콘이 필요합니다.`);
});
['taskSelect', 'taskReset', 'documentReview', 'documentReviewUndo', 'supportHint', 'supportRisk', 'projectSelect', 'projectHeld', 'codingBlocked', 'codeFileSelect', 'codeSubmit'].forEach((key) => {
  assert.ok(sfxSource.includes(`${key}: [`), `${key} 전용 효과음이 필요합니다.`);
});
assert.match(pageSource, /setActionResult\(presentation\.detail/, '로그 없는 상태 변화도 결과 패널에 즉시 설명해야 합니다.');
assert.ok(componentSource.includes('cue="codeSubmit"'), '과제 검수 버튼은 실행음과 결과음을 구분해야 합니다.');
assert.ok(componentSource.includes('data-game-sfx-change="codeFileSelect"'), '코드 파일 전환은 전용 선택음을 사용해야 합니다.');

const panelTitleUses = (componentSource.match(/<SiCodingPanelTitle\b/g) || []).length;
const iconRowUses = (componentSource.match(/<SiCodingIconRow\b/g) || []).length;
assert.ok(panelTitleUses >= 20, '주요 기능 패널 제목에 의미 아이콘이 표시되어야 합니다.');
assert.ok(iconRowUses >= 18, '과제, 문서, 검수, 성장 결과 행에 의미 아이콘이 표시되어야 합니다.');

console.log(JSON.stringify({
  transitions: 17,
  contextualResultIcons: 23,
  panelTitleUses,
  iconRowUses,
  persistenceMessages: true,
}, null, 2));
