const FEEDBACK = {
  roomCreate: {
    action: 'room',
    cue: 'twentyRoomCreate',
    label: '방 생성',
    text: '새 스무고개 방을 만들었습니다.',
    tone: 'blue',
  },
  question: {
    action: 'question',
    cue: 'twentyQuestion',
    label: '질문 등록',
    text: '질문을 등록했습니다. 방장의 답변을 기다립니다.',
    tone: 'blue',
  },
  hint: {
    action: 'hint',
    cue: 'twentyHint',
    label: '힌트 공개',
    text: '참가자에게 새 힌트를 공개했습니다.',
    tone: 'gold',
  },
  close: {
    action: 'close',
    cue: 'twentyRoomClose',
    label: '방 종료',
    text: '스무고개 방을 종료했습니다.',
    tone: 'gray',
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
          action: 'victory',
          cue: 'twentyCorrect',
          label: '정답',
          text: '정답을 맞혔습니다.',
          tone: 'green',
        }
      : {
          action: 'guess',
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
