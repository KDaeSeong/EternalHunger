const FEEDBACK = {
  roomCreate: {
    action: 'room',
    cue: 'twentyRoomCreate',
    label: '방 생성',
    text: '새 스무고개 방을 만들었습니다.',
    tone: 'blue',
  },
  roomEnter: {
    action: 'room-enter',
    cue: 'twentyRoomEnter',
    label: '방 입장',
    text: '스무고개 방으로 이동합니다.',
    tone: 'blue',
  },
  participantJoin: {
    action: 'participant-join',
    cue: 'twentyParticipantJoin',
    label: '참가자 입장',
    text: '새 참가자가 방에 들어왔습니다.',
    tone: 'green',
  },
  participantLeave: {
    action: 'participant-leave',
    cue: 'twentyParticipantLeave',
    label: '참가자 퇴장',
    text: '참가자가 방을 나갔습니다.',
    tone: 'gray',
  },
  question: {
    action: 'question-queued',
    cue: 'twentyQuestionQueued',
    label: '답변 대기',
    text: '질문을 등록했습니다. 방장의 답변을 기다립니다.',
    tone: 'blue',
  },
  remoteQuestion: {
    action: 'question-queued',
    cue: 'twentyQuestionArrive',
    label: '새 질문',
    text: '새 질문이 등록되었습니다.',
    tone: 'blue',
  },
  remoteWrong: {
    action: 'guess-wrong',
    cue: 'twentyRemoteWrong',
    label: '다른 참가자 오답',
    text: '다른 참가자의 정답 도전은 오답입니다.',
    tone: 'red',
  },
  remoteSolved: {
    action: 'room-solved',
    cue: 'twentyRemoteSolved',
    label: '정답 발견',
    text: '다른 참가자가 정답을 맞혔습니다.',
    tone: 'green',
  },
  phaseNarrow: {
    action: 'deduction-narrow',
    cue: 'twentyPhaseNarrow',
    label: '범위 압축',
    text: '절반의 시도를 사용했습니다. 지금까지의 단서로 후보를 좁힐 때입니다.',
    tone: 'gold',
  },
  phaseFinal: {
    action: 'deduction-final',
    cue: 'twentyPhaseFinal',
    label: '최종 추리',
    text: '남은 시도가 5회 이하입니다. 가장 가능성 높은 답을 검증하세요.',
    tone: 'red',
  },
  phasePending: {
    action: 'answer-pending',
    cue: 'twentyPhasePending',
    label: '마지막 답변 대기',
    text: '20번째 질문이 등록되었습니다. 방장의 마지막 답변을 기다립니다.',
    tone: 'gold',
  },
  hint: {
    action: 'hint-message',
    cue: 'twentyHintSent',
    label: '힌트 공개',
    text: '참가자에게 새 힌트를 공개했습니다.',
    tone: 'gold',
  },
  remoteHint: {
    action: 'hint-message',
    cue: 'twentyHintArrive',
    label: '새 힌트',
    text: '방장이 새 힌트를 공개했습니다.',
    tone: 'gold',
  },
  close: {
    action: 'room-closed',
    cue: 'twentyRoomClose',
    label: '방 종료',
    text: '스무고개 방을 종료했습니다.',
    tone: 'gray',
  },
  exhausted: {
    action: 'attempt-limit',
    cue: 'twentyAttemptsExhausted',
    label: '횟수 소진',
    text: '질문과 정답 도전에 사용할 횟수가 남지 않았습니다.',
    tone: 'red',
  },
  limitReveal: {
    action: 'answer-reveal',
    cue: 'twentyLimitReveal',
    label: '정답 공개',
    text: '20회를 모두 사용했습니다. 정답을 공개합니다.',
    tone: 'gold',
  },
  hostOnly: {
    action: 'lock',
    cue: 'twentyHostOnly',
    label: '방장 전용',
    text: '이 행동은 방장만 할 수 있습니다.',
    tone: 'gold',
  },
  refresh: {
    action: 'refresh',
    cue: 'twentyRefresh',
    label: '목록 갱신',
    text: '최신 스무고개 방 목록을 불러왔습니다.',
    tone: 'blue',
  },
};

const FAILURE_FEEDBACK = {
  roomCreateFailure: {
    action: 'room-create-failure',
    cue: 'twentyRoomCreateFailure',
    label: '방 생성 실패',
    text: '스무고개 방을 만들지 못했습니다.',
    tone: 'red',
  },
  roomLoadFailure: {
    action: 'room-load-failure',
    cue: 'twentyRoomLoadFailure',
    label: '방 불러오기 실패',
    text: '스무고개 방 정보를 불러오지 못했습니다.',
    tone: 'red',
  },
  questionFailure: {
    action: 'question-failure',
    cue: 'twentyQuestionFailure',
    label: '질문 등록 실패',
    text: '질문을 등록하지 못했습니다.',
    tone: 'red',
  },
  answerFailure: {
    action: 'answer-failure',
    cue: 'twentyAnswerFailure',
    label: '답변 저장 실패',
    text: '질문 답변을 저장하지 못했습니다.',
    tone: 'red',
  },
  guessFailure: {
    action: 'guess-failure',
    cue: 'twentyGuessFailure',
    label: '정답 도전 실패',
    text: '정답 도전을 처리하지 못했습니다.',
    tone: 'red',
  },
  hintFailure: {
    action: 'hint-failure',
    cue: 'twentyHintFailure',
    label: '힌트 등록 실패',
    text: '힌트를 등록하지 못했습니다.',
    tone: 'red',
  },
  closeFailure: {
    action: 'room-close-failure',
    cue: 'twentyRoomCloseFailure',
    label: '방 종료 실패',
    text: '스무고개 방을 종료하지 못했습니다.',
    tone: 'red',
  },
};

const ANSWER_FEEDBACK = {
  yes: {
    action: 'answer-yes',
    cue: 'twentyAnswerYes',
    label: '예',
    text: '질문에 예로 답했습니다.',
    tone: 'green',
  },
  no: {
    action: 'answer-no',
    cue: 'twentyAnswerNo',
    label: '아니오',
    text: '질문에 아니오로 답했습니다.',
    tone: 'red',
  },
  maybe: {
    action: 'answer-maybe',
    cue: 'twentyAnswerMaybe',
    label: '애매함',
    text: '질문에 애매함으로 답했습니다.',
    tone: 'gold',
  },
};

export function twentyQuestionsFeedback(action, result = {}) {
  const ok = result.ok !== false;
  const failure = FAILURE_FEEDBACK[action];
  if (!ok || action === 'invalid' || failure) {
    const row = failure || {
      action: 'warning',
      cue: 'twentyInvalid',
      label: '처리 실패',
      text: '요청을 처리하지 못했습니다.',
      tone: 'red',
    };
    return { ...row, text: String(result.message || row.text) };
  }

  if (action === 'answer') {
    const row = ANSWER_FEEDBACK[String(result.response || '')] || ANSWER_FEEDBACK.maybe;
    return { ...row, text: String(result.message || row.text) };
  }

  if (action === 'guess') {
    const correct = Boolean(result.correct);
    const row = correct
      ? {
          action: 'guess-correct',
          cue: 'twentyCorrect',
          label: '정답',
          text: '정답을 맞혔습니다.',
          tone: 'green',
        }
      : {
          action: 'guess-wrong',
          cue: 'twentyWrong',
          label: '오답',
          text: '정답이 아닙니다. 남은 횟수를 확인하세요.',
          tone: 'red',
        };
    return { ...row, text: String(result.message || row.text) };
  }

  const row = FEEDBACK[action] || FEEDBACK.refresh;
  return { ...row, text: String(result.message || row.text) };
}
