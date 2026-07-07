import Link from 'next/link';

import { formatNumber, formatPercent, normalizeList, safeText } from '../_lib/homePageUtils';

export function ProgressBar({ value }) {
  return (
    <div className="home-progress-bar" aria-label={`진행도 ${formatPercent(value)}`}>
      <span style={{ width: formatPercent(value) }} />
    </div>
  );
}

export function NextGoalRows({ goals }) {
  if (!goals.length) return <div className="home-empty">지금 표시할 다음 목표가 없습니다.</div>;

  return (
    <div className="home-next-goals">
      {goals.map((goal) => {
        const href = safeText(goal?.href, '/achievements');
        const valueText = `${formatNumber(goal?.value)} / ${formatNumber(goal?.target)}`;
        return (
          <Link href={href} className="home-goal-row" key={goal?.id || goal?.title}>
            <div>
              <strong>{safeText(goal?.title, '업적')}</strong>
              <span>{safeText(goal?.sectionLabel, '업적')} · {valueText}</span>
            </div>
            <small>{formatPercent(goal?.progress)}</small>
            <ProgressBar value={goal?.progress} />
          </Link>
        );
      })}
    </div>
  );
}

export function OnboardingRows({ onboarding }) {
  const steps = normalizeList(onboarding?.next).slice(0, 3);
  if (!steps.length) return <div className="home-empty">시작 체크리스트를 모두 완료했습니다.</div>;

  return (
    <div className="home-onboarding-rows">
      {steps.map((step) => (
        <Link href={safeText(step?.href, '/achievements')} className="home-onboarding-row" key={step?.id || step?.title}>
          <span>다음</span>
          <div>
            <strong>{safeText(step?.title, '시작 항목')}</strong>
            <small>{safeText(step?.description, '')}</small>
          </div>
        </Link>
      ))}
    </div>
  );
}
