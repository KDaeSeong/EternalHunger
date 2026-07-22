export const TWENTY_QUESTIONS_BGM_SCENES = Object.freeze({
  lobby: 'twenty-lobby',
  create: 'twenty-create',
  inquiry: 'twenty-inquiry',
  pending: 'twenty-pending',
  guess: 'twenty-guess',
  reveal: 'twenty-reveal',
  setback: 'twenty-setback',
});

export const TWENTY_QUESTIONS_SOUNDTRACK = Object.freeze([
  Object.freeze({ scene: 'lobby', theme: TWENTY_QUESTIONS_BGM_SCENES.lobby, title: '열린 문제집', icon: 'room' }),
  Object.freeze({ scene: 'create', theme: TWENTY_QUESTIONS_BGM_SCENES.create, title: '비밀을 봉인하다', icon: 'room-active' }),
  Object.freeze({ scene: 'inquiry', theme: TWENTY_QUESTIONS_BGM_SCENES.inquiry, title: '단서의 연쇄', icon: 'question' }),
  Object.freeze({ scene: 'pending', theme: TWENTY_QUESTIONS_BGM_SCENES.pending, title: '대답을 기다리며', icon: 'answer-pending' }),
  Object.freeze({ scene: 'guess', theme: TWENTY_QUESTIONS_BGM_SCENES.guess, title: '마지막 가설', icon: 'guess' }),
  Object.freeze({ scene: 'reveal', theme: TWENTY_QUESTIONS_BGM_SCENES.reveal, title: '비밀이 풀리다', icon: 'guess-correct' }),
  Object.freeze({ scene: 'setback', theme: TWENTY_QUESTIONS_BGM_SCENES.setback, title: '닫힌 가능성', icon: 'attempt-limit' }),
]);

export function resolveTwentyQuestionsLobbyBgmScene({
  writerOpen = false,
  loadError = '',
} = {}) {
  if (loadError) return TWENTY_QUESTIONS_BGM_SCENES.setback;
  if (writerOpen) return TWENTY_QUESTIONS_BGM_SCENES.create;
  return TWENTY_QUESTIONS_BGM_SCENES.lobby;
}

export function resolveTwentyQuestionsRoomBgmScene({
  status = 'active',
  answerRevealed = false,
  attemptsLeft = 20,
  pendingCount = 0,
  isHost = false,
  submitting = '',
} = {}) {
  if (status === 'solved' || answerRevealed) return TWENTY_QUESTIONS_BGM_SCENES.reveal;
  if (status === 'closed' || Number(attemptsLeft || 0) <= 0) {
    return TWENTY_QUESTIONS_BGM_SCENES.setback;
  }
  if (String(submitting || '') === 'guess' || Number(attemptsLeft || 0) <= 5) {
    return TWENTY_QUESTIONS_BGM_SCENES.guess;
  }
  if (isHost && Number(pendingCount || 0) > 0) return TWENTY_QUESTIONS_BGM_SCENES.pending;
  return TWENTY_QUESTIONS_BGM_SCENES.inquiry;
}

export function twentyQuestionsResultMusic(feedback = {}) {
  const action = String(feedback?.action || '');
  if (action === 'guess-correct' || action === 'room-solved') {
    return { theme: TWENTY_QUESTIONS_BGM_SCENES.reveal, durationMs: 14_000 };
  }
  if (action === 'guess-wrong') {
    return { theme: TWENTY_QUESTIONS_BGM_SCENES.guess, durationMs: 10_000 };
  }
  if (action === 'warning' || action === 'attempt-limit' || action === 'room-closed') {
    return { theme: TWENTY_QUESTIONS_BGM_SCENES.setback, durationMs: 11_000 };
  }
  if (action === 'question-queued' || action === 'answer-pending') {
    return { theme: TWENTY_QUESTIONS_BGM_SCENES.pending, durationMs: 9_000 };
  }
  if (action === 'answer-yes' || action === 'answer-no' || action === 'answer-maybe' || action === 'hint-message') {
    return { theme: TWENTY_QUESTIONS_BGM_SCENES.inquiry, durationMs: 8_000 };
  }
  if (action === 'room') return { theme: TWENTY_QUESTIONS_BGM_SCENES.create, durationMs: 9_000 };
  if (action === 'room-enter') return { theme: TWENTY_QUESTIONS_BGM_SCENES.inquiry, durationMs: 8_000 };
  if (action === 'refresh') return { theme: TWENTY_QUESTIONS_BGM_SCENES.lobby, durationMs: 7_000 };
  return null;
}
