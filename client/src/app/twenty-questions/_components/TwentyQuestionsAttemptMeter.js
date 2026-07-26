import GameActionIcon from '../../games/_components/GameActionIcon';
import { TWENTY_QUESTIONS_PHASE_STEPS } from '../_lib/twentyQuestionsProgress';

export default function TwentyQuestionsAttemptMeter({ progress }) {
  if (!progress) return null;
  const { phase } = progress;

  return (
    <section className={`twenty-attempt-meter is-${phase.tone}`} aria-label="추리 진행">
      <div className="twenty-attempt-meter__summary">
        <span>
          <GameActionIcon action={phase.action} label={phase.label} />
          {phase.label}
        </span>
        <strong>{progress.attemptCount}/{progress.maxQuestions} · {progress.remainingCount}회 남음</strong>
      </div>
      <div
        className="twenty-attempt-meter__track"
        role="progressbar"
        aria-label="질문과 정답 도전 사용량"
        aria-valuemin={0}
        aria-valuemax={progress.maxQuestions}
        aria-valuenow={progress.attemptCount}
      >
        <span style={{ width: `${progress.progressPct}%` }} />
      </div>
      <div className="twenty-attempt-meter__stages" aria-hidden="true">
        {TWENTY_QUESTIONS_PHASE_STEPS.map((stage, index) => (
          <span
            className={`${index === progress.stageIndex ? 'is-current' : ''} ${index < progress.stageIndex ? 'is-complete' : ''}`}
            key={stage.id}
          >
            <GameActionIcon action={stage.action} label={stage.label} />
            {stage.shortLabel}
          </span>
        ))}
      </div>
    </section>
  );
}
