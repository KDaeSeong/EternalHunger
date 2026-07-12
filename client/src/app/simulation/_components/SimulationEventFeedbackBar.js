'use client';

import GameActionIcon from '../../games/_components/GameActionIcon';

export default function SimulationEventFeedbackBar({ feedback }) {
  if (!feedback) return null;

  return (
    <div
      className="simulation-event-feedback"
      data-tone={feedback.tone || 'ready'}
      role="status"
      aria-live="polite"
    >
      <GameActionIcon action={feedback.action || 'event'} label={feedback.label || '주요 사건'} />
      <span className="simulation-event-feedback__copy">
        <strong>{feedback.label || '주요 사건'}</strong>
        <span>{feedback.text || '경기 상태가 변경됐습니다.'}</span>
      </span>
    </div>
  );
}
