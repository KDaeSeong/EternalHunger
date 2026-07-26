import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/app/twenty-questions/_lib/twentyQuestionsFeedback.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { twentyQuestionsFeedback } = await import(moduleUrl);
const [iconSource, sfxSource, shellSource, roomSource, lobbySource, progressSource, meterSource, styleSource] = await Promise.all([
  readFile(new URL('../src/app/games/_components/GameActionIcon.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/games/_lib/useGameSfx.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/games/_components/GamePlayShell.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/twenty-questions/_components/TwentyQuestionsRoomContent.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/twenty-questions/page.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/twenty-questions/_lib/twentyQuestionsProgress.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/twenty-questions/_components/TwentyQuestionsAttemptMeter.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/TwentyQuestions.css', import.meta.url), 'utf8'),
]);
const progressModuleUrl = `data:text/javascript;base64,${Buffer.from(progressSource).toString('base64')}`;
const {
  resolveTwentyQuestionsProgress,
  twentyQuestionsProgressTransition,
} = await import(progressModuleUrl);

const cases = [
  ['roomCreate', {}, 'twentyRoomCreate', 'room'],
  ['roomEnter', {}, 'twentyRoomEnter', 'room-enter'],
  ['participantJoin', {}, 'twentyParticipantJoin', 'participant-join'],
  ['participantLeave', {}, 'twentyParticipantLeave', 'participant-leave'],
  ['question', {}, 'twentyQuestionQueued', 'question-queued'],
  ['remoteQuestion', {}, 'twentyQuestionArrive', 'question-queued'],
  ['remoteWrong', {}, 'twentyRemoteWrong', 'guess-wrong'],
  ['remoteSolved', {}, 'twentyRemoteSolved', 'room-solved'],
  ['phaseNarrow', {}, 'twentyPhaseNarrow', 'deduction-narrow'],
  ['phaseFinal', {}, 'twentyPhaseFinal', 'deduction-final'],
  ['phasePending', {}, 'twentyPhasePending', 'answer-pending'],
  ['answer', { response: 'yes' }, 'twentyAnswerYes', 'answer-yes'],
  ['answer', { response: 'no' }, 'twentyAnswerNo', 'answer-no'],
  ['answer', { response: 'maybe' }, 'twentyAnswerMaybe', 'answer-maybe'],
  ['guess', { correct: true }, 'twentyCorrect', 'guess-correct'],
  ['guess', { correct: false }, 'twentyWrong', 'guess-wrong'],
  ['hint', {}, 'twentyHintSent', 'hint-message'],
  ['remoteHint', {}, 'twentyHintArrive', 'hint-message'],
  ['close', {}, 'twentyRoomClose', 'room-closed'],
  ['exhausted', {}, 'twentyAttemptsExhausted', 'attempt-limit'],
  ['limitReveal', {}, 'twentyLimitReveal', 'answer-reveal'],
  ['hostOnly', {}, 'twentyHostOnly', 'lock'],
  ['refresh', {}, 'twentyRefresh', 'refresh'],
  ['invalid', { ok: false, message: '입력을 확인하세요.' }, 'twentyInvalid', 'warning'],
  ['roomCreateFailure', { ok: false }, 'twentyRoomCreateFailure', 'room-create-failure'],
  ['roomLoadFailure', { ok: false }, 'twentyRoomLoadFailure', 'room-load-failure'],
  ['questionFailure', { ok: false }, 'twentyQuestionFailure', 'question-failure'],
  ['answerFailure', { ok: false }, 'twentyAnswerFailure', 'answer-failure'],
  ['guessFailure', { ok: false }, 'twentyGuessFailure', 'guess-failure'],
  ['hintFailure', { ok: false }, 'twentyHintFailure', 'hint-failure'],
  ['closeFailure', { ok: false }, 'twentyRoomCloseFailure', 'room-close-failure'],
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
const navigationCues = ['twentyWriterOpen', 'twentyWriterClose', 'twentyFilter', 'twentyTabDeduction', 'twentyTabHints', 'twentyTabHistory'];
for (const cue of navigationCues) assert.ok(sfxSource.includes(`${cue}: [`), `${cue} 전용 UI 효과음 프로필이 있어야 합니다.`);
assert.ok(shellSource.includes("data-game-sfx={tab.cue || 'tab'}"), '공통 기능 탭은 게임별 전용 효과음을 받을 수 있어야 합니다.');
assert.ok(lobbySource.includes("cue={writerOpen ? 'twentyWriterClose' : 'twentyWriterOpen'}"), '방 만들기 패널 열기와 닫기는 서로 다른 전용음을 사용해야 합니다.');
assert.equal((lobbySource.match(/data-game-sfx-change="twentyFilter"/g) || []).length, 2, '상태와 카테고리 필터는 전용 필터음을 사용해야 합니다.');
for (const cue of ['twentyTabDeduction', 'twentyTabHints', 'twentyTabHistory']) assert.ok(roomSource.includes(`cue: '${cue}'`), `${cue}가 해당 기능 탭에 연결되어야 합니다.`);
assert.ok(lobbySource.includes('action="room" cue="off" onClick={createRoom}'), '방 생성은 선행 클릭음 없이 서버 결과음만 재생해야 합니다.');
for (const action of ['question', 'guess', 'hint']) assert.ok(roomSource.includes(`action="${action}" cue="off"`), `${action} 행동은 선행 클릭음 없이 서버 결과음만 재생해야 합니다.`);
assert.ok(roomSource.includes('action={`answer-${option.value}`}') && roomSource.includes('cue="off"'), '방장 답변은 선행 클릭음 없이 서버 결과음만 재생해야 합니다.');
assert.ok(roomSource.includes('action="close" cue="off"'), '방 종료는 선행 경고음 없이 서버 결과음만 재생해야 합니다.');
assert.ok(styleSource.includes('.twenty-empty.twenty-inline-state'), '아이콘이 있는 빈 상태는 중앙 정렬되어야 합니다.');
assert.ok(roomSource.includes("announce('exhausted'"), '횟수 소진은 일반 오류와 다른 피드백을 사용해야 합니다.');
assert.ok(roomSource.includes("announce('hostOnly'"), '방장 전용 행동은 일반 오류와 다른 피드백을 사용해야 합니다.');
for (const action of ['roomLoadFailure', 'questionFailure', 'answerFailure', 'guessFailure', 'hintFailure', 'closeFailure']) {
  assert.ok(roomSource.includes(`announce('${action}'`), `${action}는 일반 입력 오류와 다른 피드백을 사용해야 합니다.`);
}
assert.ok(lobbySource.includes("announce(ok ? 'refresh' : 'roomLoadFailure'"), '방 목록 갱신 실패는 전용 불러오기 피드백을 사용해야 합니다.');
assert.ok(lobbySource.includes("announce('roomCreateFailure'"), '방 생성 실패는 전용 피드백을 사용해야 합니다.');
assert.equal((roomSource.match(/announce\('invalid'/g) || []).length, 3, '빈 질문·정답 도전·힌트만 일반 입력 오류를 사용해야 합니다.');
assert.equal((lobbySource.match(/announce\('invalid'/g) || []).length, 1, '빈 방 제목·정답만 일반 입력 오류를 사용해야 합니다.');
assert.ok(roomSource.includes('ROOM_POLL_INTERVAL_MS'), '진행 중인 방은 짧은 간격으로 최신 상태를 동기화해야 합니다.');
assert.ok(roomSource.includes('announceRemoteRoomChange'), '원격 질문·답변·힌트·도전을 상황별로 알려야 합니다.');
assert.ok(roomSource.includes('PRESENCE_HEARTBEAT_INTERVAL_MS') && roomSource.includes('/presence'), '인증 참가자는 실제 접속 하트비트를 보내야 합니다.');
assert.ok(roomSource.includes("announce('participantJoin'") && roomSource.includes("announce('participantLeave'"), '원격 참가자 입장·퇴장을 서로 다른 피드백으로 알려야 합니다.');
assert.ok(roomSource.includes("announce('remoteSolved'") && roomSource.includes("announce('remoteWrong'"), '다른 참가자의 정답과 오답을 서로 다른 피드백으로 알려야 합니다.');
assert.ok(roomSource.includes("room.status === 'solved' ? 'guess-correct' : 'answer-reveal'"), '정답 적중과 횟수 소진 공개는 서로 다른 아이콘을 사용해야 합니다.');
assert.ok(roomSource.includes('action="participant-count"'), '방 요약에서 현재 접속 참가자 수를 보여야 합니다.');
assert.ok(roomSource.includes("active && !room?.isHost"), '방장은 참가자 질문·정답 도전 입력을 볼 수 없어야 합니다.');
assert.ok(roomSource.includes('<GameFeatureTabs'), '추리·힌트·기록은 한 화면 기능 탭으로 구성해야 합니다.');
assert.ok(roomSource.includes("id: 'deduction'") && roomSource.includes("id: 'hints'") && roomSource.includes("id: 'history'"), '세 기능 탭이 모두 있어야 합니다.');
assert.ok(roomSource.includes('attemptTimeline'), '질문과 정답 도전은 공유 횟수 순서의 통합 기록으로 보여야 합니다.');
assert.ok(roomSource.includes('<TwentyQuestionsAttemptMeter'), '방 요약에는 공유 시도 추리 진행계가 있어야 합니다.');
assert.ok(roomSource.includes('twentyQuestionsProgressTransition'), '로컬·원격 시도는 추리 단계 전환을 감지해야 합니다.');
assert.ok(roomSource.includes('다시 불러오기') && roomSource.includes('loadError'), '방 로드 실패는 실제 오류와 재시도를 제공해야 합니다.');
assert.ok(meterSource.includes('role="progressbar"'), '추리 진행계는 접근 가능한 진행률 정보를 제공해야 합니다.');

const opening = resolveTwentyQuestionsProgress({ attemptCount: 0, maxQuestions: 20 });
const narrowing = resolveTwentyQuestionsProgress({ attemptCount: 10, maxQuestions: 20 });
const final = resolveTwentyQuestionsProgress({ attemptCount: 15, maxQuestions: 20 });
const pending = resolveTwentyQuestionsProgress({ attemptCount: 20, maxQuestions: 20, pendingCount: 1 });
const solved = resolveTwentyQuestionsProgress({ status: 'solved', attemptCount: 7, maxQuestions: 20 });
assert.equal(opening.phase.id, 'explore', '초반 시도는 탐색 단계여야 합니다.');
assert.equal(narrowing.phase.id, 'narrow', '10번째 시도부터 범위 압축 단계여야 합니다.');
assert.equal(final.phase.id, 'final', '15번째 시도부터 최종 추리 단계여야 합니다.');
assert.equal(pending.phase.id, 'pending', '마지막 질문이 남으면 종료가 아니라 답변 대기 단계여야 합니다.');
assert.equal(solved.phase.id, 'solved', '정답을 맞힌 방은 해결 단계여야 합니다.');
assert.equal(twentyQuestionsProgressTransition({ attemptCount: 9 }, { attemptCount: 10 }), 'phaseNarrow');
assert.equal(twentyQuestionsProgressTransition({ attemptCount: 14 }, { attemptCount: 15 }), 'phaseFinal');
assert.equal(twentyQuestionsProgressTransition(
  { attemptCount: 19, pendingCount: 0 },
  { attemptCount: 20, pendingCount: 1 },
), 'phasePending');

const semanticIconUses = (roomSource.match(/<GameActionIcon\b/g) || []).length
  + (lobbySource.match(/<GameActionIcon\b/g) || []).length
  + (meterSource.match(/<GameActionIcon\b/g) || []).length;
assert.ok(semanticIconUses >= 50, '로비와 방 상태에 충분한 의미 아이콘이 배치되어야 합니다.');

console.log(JSON.stringify({
  feedbackCases: cases.length,
  semanticIconUses,
  correctCue: twentyQuestionsFeedback('guess', { correct: true }).cue,
  wrongCue: twentyQuestionsFeedback('guess', { correct: false }).cue,
  hostAnswers: ['yes', 'no', 'maybe'].map((response) => twentyQuestionsFeedback('answer', { response }).cue),
  progressPhases: [opening.phase.id, narrowing.phase.id, final.phase.id, pending.phase.id, solved.phase.id],
  navigationCues,
  resultCueGuards: 6,
}, null, 2));
