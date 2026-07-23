import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const {
  closeExhaustedRoom,
  getAttemptCounts,
  shouldCloseExhaustedRoom,
} = require('../../server/utils/twentyQuestionsRules');

const answeredQuestions = (count) => Array.from({ length: count }, (_, index) => ({
  response: index % 3 === 0 ? 'yes' : index % 3 === 1 ? 'no' : 'maybe',
}));

const mixedRoom = {
  status: 'active',
  maxQuestions: 20,
  questions: answeredQuestions(12),
  guesses: Array.from({ length: 5 }, () => ({ correct: false })),
};
const mixedCounts = getAttemptCounts(mixedRoom);
assert.equal(mixedCounts.attemptCount, 17, '질문과 정답 도전은 하나의 시도 횟수로 합산해야 합니다.');
assert.equal(mixedCounts.remainingCount, 3, '공유 횟수의 남은 수가 정확해야 합니다.');
assert.equal(mixedCounts.pendingCount, 0, '답변 완료 질문은 대기 수에 포함하지 않아야 합니다.');
assert.equal(shouldCloseExhaustedRoom(mixedRoom), false, '횟수가 남은 방은 종료하지 않아야 합니다.');

const pendingFinalQuestionRoom = {
  status: 'active',
  maxQuestions: 20,
  questions: [...answeredQuestions(19), { response: 'pending' }],
  guesses: [],
};
assert.equal(shouldCloseExhaustedRoom(pendingFinalQuestionRoom), false, '마지막 질문의 답변 전에는 정답을 공개하지 않아야 합니다.');
pendingFinalQuestionRoom.questions[19].response = 'yes';
assert.equal(closeExhaustedRoom(pendingFinalQuestionRoom), true, '마지막 질문 답변 후 방을 자동 종료해야 합니다.');
assert.equal(pendingFinalQuestionRoom.status, 'closed', '자동 종료 시 방 상태가 closed여야 합니다.');

const finalWrongGuessRoom = {
  status: 'active',
  maxQuestions: 20,
  questions: answeredQuestions(19),
  guesses: [{ correct: false }],
};
assert.equal(closeExhaustedRoom(finalWrongGuessRoom), true, '마지막 오답 도전 후 대기 질문이 없으면 자동 종료해야 합니다.');
assert.equal(closeExhaustedRoom(finalWrongGuessRoom), false, '이미 종료된 방을 다시 종료 처리하지 않아야 합니다.');

const routeSource = await readFile(new URL('../../server/routes/twentyQuestions.js', import.meta.url), 'utf8');
const hostParticipantGuards = routeSource.match(/if \(isHost\(room, req\.user\.id\)\) return res\.status\(403\)/g) || [];
const exhaustionCalls = routeSource.match(/closeExhaustedRoom\(room\)/g) || [];
assert.ok(hostParticipantGuards.length >= 2, '질문과 정답 도전 API 모두 방장 참가를 차단해야 합니다.');
assert.ok(exhaustionCalls.length >= 2, '질문 답변과 오답 도전 뒤 자동 종료를 확인해야 합니다.');
assert.ok(routeSource.includes('exhausted,'), '자동 종료 여부를 클라이언트 응답에 포함해야 합니다.');

console.log(JSON.stringify({
  sharedAttempts: mixedCounts.attemptCount,
  hostParticipantGuards: hostParticipantGuards.length,
  exhaustionCalls: exhaustionCalls.length,
  pendingFinalQuestionWaits: true,
  finalWrongGuessCloses: true,
}, null, 2));
