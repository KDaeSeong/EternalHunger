const PHASES = Object.freeze({
  explore: Object.freeze({
    id: 'explore',
    label: '초반 탐색',
    shortLabel: '탐색',
    action: 'deduction-explore',
    tone: 'blue',
  }),
  narrow: Object.freeze({
    id: 'narrow',
    label: '범위 압축',
    shortLabel: '압축',
    action: 'deduction-narrow',
    tone: 'gold',
  }),
  final: Object.freeze({
    id: 'final',
    label: '최종 추리',
    shortLabel: '승부',
    action: 'deduction-final',
    tone: 'red',
  }),
  pending: Object.freeze({
    id: 'pending',
    label: '마지막 답변 대기',
    shortLabel: '대기',
    action: 'answer-pending',
    tone: 'gold',
  }),
  solved: Object.freeze({
    id: 'solved',
    label: '정답 공개',
    shortLabel: '해결',
    action: 'guess-correct',
    tone: 'green',
  }),
  exhausted: Object.freeze({
    id: 'exhausted',
    label: '시도 소진',
    shortLabel: '소진',
    action: 'attempt-limit',
    tone: 'red',
  }),
  closed: Object.freeze({
    id: 'closed',
    label: '추리 종료',
    shortLabel: '종료',
    action: 'room-closed',
    tone: 'gray',
  }),
});

export const TWENTY_QUESTIONS_PHASE_STEPS = Object.freeze([
  PHASES.explore,
  PHASES.narrow,
  PHASES.final,
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteCount(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

export function resolveTwentyQuestionsProgress({
  status = 'active',
  answerRevealed = false,
  attemptCount = 0,
  maxQuestions = 20,
  pendingCount = 0,
} = {}) {
  const maximum = Math.max(1, finiteCount(maxQuestions, 20));
  const used = clamp(finiteCount(attemptCount), 0, maximum);
  const remaining = Math.max(0, maximum - used);
  const pending = finiteCount(pendingCount);
  const narrowAt = Math.ceil(maximum * 0.5);
  const finalAt = Math.max(narrowAt + 1, maximum - Math.max(1, Math.ceil(maximum * 0.25)));
  const stageIndex = used >= finalAt ? 2 : used >= narrowAt ? 1 : 0;

  let phase = PHASES.explore;
  if (status === 'solved' || answerRevealed) phase = PHASES.solved;
  else if (status === 'closed') phase = PHASES.closed;
  else if (remaining === 0 && pending > 0) phase = PHASES.pending;
  else if (remaining === 0) phase = PHASES.exhausted;
  else if (stageIndex === 2) phase = PHASES.final;
  else if (stageIndex === 1) phase = PHASES.narrow;

  return {
    phase,
    stageIndex,
    attemptCount: used,
    maxQuestions: maximum,
    remainingCount: remaining,
    pendingCount: pending,
    progressPct: Math.round((used / maximum) * 100),
    narrowAt,
    finalAt,
  };
}

export function twentyQuestionsRoomProgress(room = {}) {
  const questions = Array.isArray(room?.questions) ? room.questions : [];
  const guesses = Array.isArray(room?.guesses) ? room.guesses : [];
  const attemptCount = room?.attemptCount != null
    ? room.attemptCount
    : questions.length + guesses.length;
  const pendingCount = room?.pendingCount != null
    ? room.pendingCount
    : questions.filter((question) => question?.response === 'pending').length;

  return resolveTwentyQuestionsProgress({
    status: room?.status,
    answerRevealed: room?.answerRevealed,
    attemptCount,
    maxQuestions: room?.maxQuestions,
    pendingCount,
  });
}

export function twentyQuestionsProgressTransition(previousRoom, nextRoom) {
  if (!previousRoom || !nextRoom) return '';
  const previous = twentyQuestionsRoomProgress(previousRoom);
  const next = twentyQuestionsRoomProgress(nextRoom);
  if (previous.phase.id === next.phase.id) return '';
  if (next.phase.id === 'pending') return 'phasePending';
  if (next.phase.id === 'final') return 'phaseFinal';
  if (next.phase.id === 'narrow') return 'phaseNarrow';
  return '';
}
