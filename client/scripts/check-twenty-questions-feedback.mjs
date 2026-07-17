import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/twenty-questions/_lib/twentyQuestionsFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { twentyQuestionsFeedback } = await import(moduleUrl);
const [iconSource, sfxSource, roomSource, lobbySource] = await Promise.all([
  readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/twenty-questions/_components/TwentyQuestionsRoomContent.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/twenty-questions/page.js', import.meta.url), 'utf8'),
]);

const cases = [
  ['roomCreate', {}, 'twentyRoomCreate', 'room'],
  ['roomEnter', {}, 'twentyRoomEnter', 'room-enter'],
  ['question', {}, 'twentyQuestionQueued', 'question-queued'],
  ['answer', { response: 'yes' }, 'twentyAnswerYes', 'answer-yes'],
  ['answer', { response: 'no' }, 'twentyAnswerNo', 'answer-no'],
  ['answer', { response: 'maybe' }, 'twentyAnswerMaybe', 'answer-maybe'],
  ['guess', { correct: true }, 'twentyCorrect', 'guess-correct'],
  ['guess', { correct: false }, 'twentyWrong', 'guess-wrong'],
  ['hint', {}, 'twentyHintSent', 'hint-message'],
  ['close', {}, 'twentyRoomClose', 'room-closed'],
  ['exhausted', {}, 'twentyAttemptsExhausted', 'attempt-limit'],
  ['hostOnly', {}, 'twentyHostOnly', 'lock'],
  ['refresh', {}, 'twentyRefresh', 'refresh'],
  ['invalid', { ok: false, message: '입력을 확인하세요.' }, 'twentyInvalid', 'warning'],
];

for (const [action, result, expectedCue, expectedIcon] of cases) {
  const feedback = twentyQuestionsFeedback(action, result);
  assert.equal(feedback.cue, expectedCue, `${action} 결과음이 일치해야 합니다.`);
  assert.equal(feedback.action, expectedIcon, `${action} 아이콘 의미가 일치해야 합니다.`);
  assert.ok(feedback.label && feedback.text && feedback.tone, `${action} 피드백 표시 정보가 완전해야 합니다.`);
  assert.ok(sfxSource.includes(`${expectedCue}: [`), `${expectedCue} 전용 효과음 프로필이 있어야 합니다.`);
  assert.match(iconSource, new RegExp(`['\"]?${expectedIcon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]?\\s*:`), `${expectedIcon} 의미 아이콘이 있어야 합니다.`);
}

const custom = twentyQuestionsFeedback('guess', { correct: true, message: '케이 정답!' });
assert.equal(custom.text, '케이 정답!', '서버 결과 메시지를 피드백 행에 유지해야 합니다.');
assert.ok(lobbySource.includes('data-game-sfx="twentyRoomEnter"'), '방 카드 입장에는 전용 입장음이 연결되어야 합니다.');
assert.ok(roomSource.includes("announce('exhausted'"), '횟수 소진은 일반 오류와 다른 피드백을 사용해야 합니다.');
assert.ok(roomSource.includes("announce('hostOnly'"), '방장 전용 행동은 일반 오류와 다른 피드백을 사용해야 합니다.');

const semanticIconUses = (roomSource.match(/<GameActionIcon\b/g) || []).length
  + (lobbySource.match(/<GameActionIcon\b/g) || []).length;
assert.ok(semanticIconUses >= 28, '로비와 방 상태에 충분한 의미 아이콘이 배치되어야 합니다.');

console.log(JSON.stringify({
  feedbackCases: cases.length,
  semanticIconUses,
  correctCue: twentyQuestionsFeedback('guess', { correct: true }).cue,
  wrongCue: twentyQuestionsFeedback('guess', { correct: false }).cue,
  hostAnswers: ['yes', 'no', 'maybe'].map((response) => twentyQuestionsFeedback('answer', { response }).cue),
}, null, 2));
