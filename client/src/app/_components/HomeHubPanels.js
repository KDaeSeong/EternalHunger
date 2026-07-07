import Link from 'next/link';

import { formatDate, formatNumber, safeText } from '../_lib/homePageUtils';

export function HubLinkList({ items, empty, type }) {
  if (!items.length) return <div className="home-empty">{empty}</div>;

  return (
    <div className="home-link-list">
      {items.map((item) => {
        const href = type === 'room' ? `/twenty-questions/${item._id}` : `/board/${item._id}`;
        const roomAttemptCount = Number(item?.attemptCount != null ? item.attemptCount : Number(item?.questionCount || 0) + Number(item?.guessCount || 0));
        const roomMaxQuestions = Number(item?.maxQuestions || 20);
        const meta = type === 'room'
          ? `사용 ${formatNumber(roomAttemptCount)}/${formatNumber(roomMaxQuestions)} · 질문 ${formatNumber(item.questionCount)} · 시도 ${formatNumber(item.guessCount)}`
          : `조회 ${formatNumber(item.viewCount)} · 추천 ${formatNumber(item.reactionCount)} · 댓글 ${formatNumber(item.commentCount)} · ${formatDate(item.createdAt) || '날짜 없음'}`;
        return (
          <Link href={href} key={`${type}-${item._id || item.title}`}>
            <strong>{safeText(item.title, '제목 없음')}</strong>
            <span>{meta}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function RankingRows({ rows, empty, renderValue, renderName, renderHref }) {
  if (!rows.length) return <div className="home-empty">{empty}</div>;

  return (
    <ol className="home-ranking-list">
      {rows.slice(0, 5).map((row, index) => {
        const name = renderName(row);
        const href = renderHref?.(row) || '';
        return (
          <li key={`${name}-${index}`}>
            <span>{index + 1}</span>
            <div>
              {href ? <Link href={href}>{name}</Link> : <strong>{name}</strong>}
              <small>{renderValue(row)}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
