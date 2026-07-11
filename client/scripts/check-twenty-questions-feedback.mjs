import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/twenty-questions/_lib/twentyQuestionsFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { twentyQuestionsFeedback } = await import(moduleUrl);

const cases = [
  ['roomCreate', {}, 'twentyRoomCreate', 'room'],
  ['question', {}, 'twentyQuestion', 'question'],
  ['answer', { response: 'yes' }, 'twentyAnswerYes', 'answer-yes'],
  ['answer', { response: 'no' }, 'twentyAnswerNo', 'answer-no'],
  ['answer', { response: 'maybe' }, 'twentyAnswerMaybe', 'answer-maybe'],
  ['guess', { correct: true }, 'twentyCorrect', 'victory'],
  ['guess', { correct: false }, 'twentyWrong', 'guess'],
  ['hint', {}, 'twentyHint', 'hint'],
  ['close', {}, 'twentyRoomClose', 'close'],
  ['refresh', {}, 'twentyRefresh', 'refresh'],
  ['invalid', { ok: false, message: '입력을 확인하세요.' }, 'twentyInvalid', 'warning'],
];

for (const [action, result, expectedCue, expectedIcon] of cases) {
  const feedback = twentyQuestionsFeedback(action, result);
  assert.equal(feedback.cue, expectedCue, `${action} 결과음이 일치해야 합니다.`);
  assert.equal(feedback.action, expectedIcon, `${action} 아이콘 의미가 일치해야 합니다.`);
  assert.ok(feedback.label && feedback.text && feedback.tone, `${action} 피드백 표시 정보가 완전해야 합니다.`);
}

const custom = twentyQuestionsFeedback('guess', { correct: true, message: '케이 정답!' });
assert.equal(custom.text, '케이 정답!', '서버 결과 메시지를 피드백 행에 유지해야 합니다.');

console.log(JSON.stringify({
  feedbackCases: cases.length,
  correctCue: twentyQuestionsFeedback('guess', { correct: true }).cue,
  wrongCue: twentyQuestionsFeedback('guess', { correct: false }).cue,
  hostAnswers: ['yes', 'no', 'maybe'].map((response) => twentyQuestionsFeedback('answer', { response }).cue),
}, null, 2));
