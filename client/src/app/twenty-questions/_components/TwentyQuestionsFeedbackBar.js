import GameActionIcon from '../../games/_components/GameActionIcon';

export default function TwentyQuestionsFeedbackBar({ feedback }) {
  if (!feedback) return null;
  return (
    <section className={`twenty-feedback is-${feedback.tone}`} aria-live="polite">
      <GameActionIcon action={feedback.action} label={feedback.label} />
      <div>
        <span>{feedback.label}</span>
        <strong>{feedback.text}</strong>
      </div>
    </section>
  );
}
