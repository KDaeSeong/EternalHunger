import Link from 'next/link';

import { formatNumber, formatPercent, normalizeList, safeText } from '../_lib/homePageUtils';

export function ProgressBar({ value, label }) {
  const percent = formatPercent(value);
  return (
    <span
      className="ui-progress"
      role="progressbar"
      aria-label={label || '진행도'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number.parseInt(percent, 10) || 0}
    >
      <span style={{ width: percent }} />
    </span>
  );
}

// Logged-in summary: season score, the next goal, and the next onboarding step (only while unfinished).
export function ProgressStrip({ progress, loading, error }) {
  const season = progress.season || {};
  const maxScore = Number(season.maxScore || 0);
  const ratio = maxScore ? Number(season.score || 0) / maxScore : 0;
  const goal = normalizeList(progress.next)[0] || null;
  const step = normalizeList(progress.onboarding?.next)[0] || null;

  return (
    <section className="ui-panel hm-progress" aria-label="내 진행 상황">
      <div className="hm-progress__season">
        <span className="hm-progress__label">{safeText(season.name, '프리시즌')} 진행</span>
        <strong className="ui-num">
          {loading ? '불러오는 중' : `${formatNumber(season.score)} / ${formatNumber(maxScore)}점`}
        </strong>
        <ProgressBar value={ratio} label="시즌 진행도" />
        <span className="hm-progress__note">
          업적 {formatNumber(season.completedCount)}/{formatNumber(season.totalCount)}개 달성
        </span>
      </div>

      {error ? (
        <p className="hm-progress__item hm-progress__item--error">{error}</p>
      ) : (
        <>
          {goal ? (
            <Link href={safeText(goal?.href, '/achievements')} className="hm-progress__item">
              <span className="hm-progress__label">다음 목표</span>
              <strong>{safeText(goal?.title, '업적')}</strong>
              <span className="hm-progress__note ui-num">
                {formatNumber(goal?.value)} / {formatNumber(goal?.target)} · {formatPercent(goal?.progress)}
              </span>
            </Link>
          ) : null}
          {step ? (
            <Link href={safeText(step?.href, '/achievements')} className="hm-progress__item">
              <span className="hm-progress__label">
                시작하기 {formatNumber(progress.onboarding?.completedCount)}/{formatNumber(progress.onboarding?.totalCount)}
              </span>
              <strong>{safeText(step?.title, '시작 항목')}</strong>
              {step?.description ? <span className="hm-progress__note">{step.description}</span> : null}
            </Link>
          ) : null}
        </>
      )}

      <Link href="/achievements" className="ui-button ui-button--quiet hm-progress__more">업적 보기</Link>
    </section>
  );
}
