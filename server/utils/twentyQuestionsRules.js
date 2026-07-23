function getMaxAttempts(room) {
  return Math.max(1, Number(room?.maxQuestions || 20));
}

function getAttemptCounts(room) {
  const questions = Array.isArray(room?.questions) ? room.questions : [];
  const guesses = Array.isArray(room?.guesses) ? room.guesses : [];
  const maxQuestions = getMaxAttempts(room);
  const questionCount = questions.length;
  const guessCount = guesses.length;
  const attemptCount = questionCount + guessCount;
  const pendingCount = questions.filter((question) => question?.response === 'pending').length;

  return {
    questions,
    guesses,
    maxQuestions,
    questionCount,
    pendingCount,
    guessCount,
    attemptCount,
    remainingCount: Math.max(0, maxQuestions - attemptCount),
  };
}

function shouldCloseExhaustedRoom(room) {
  if (room?.status !== 'active') return false;
  const counts = getAttemptCounts(room);
  return counts.attemptCount >= counts.maxQuestions && counts.pendingCount === 0;
}

function closeExhaustedRoom(room) {
  if (!shouldCloseExhaustedRoom(room)) return false;
  room.status = 'closed';
  return true;
}

module.exports = {
  closeExhaustedRoom,
  getAttemptCounts,
  getMaxAttempts,
  shouldCloseExhaustedRoom,
};
