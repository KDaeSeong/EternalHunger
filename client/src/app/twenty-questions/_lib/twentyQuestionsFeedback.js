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
  remoteGuess: {
    action: 'guess',
    cue: 'twentyGuessArrive',
    label: '새 도전',
    text: '새 정답 도전이 등록되었습니다.',
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
    action: 'attempt-limit',
    cue: 'twentyLimitReveal',
    label: '정답 공개',
    text: '20회를 모두 사용했습니다. 정답을 공개합니다.',
    tone: 'red',
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
  if (!ok || action === 'invalid') {
    return {
      action: 'warning',
      cue: 'twentyInvalid',
      label: '처리 실패',
      text: String(result.message || '요청을 처리하지 못했습니다.'),
      tone: 'red',
    };
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
