import Link from 'next/link';

import { BOARD_CATEGORIES } from '../board/_lib/boardUtils';
import { findGameBySlug } from '../games/_lib/gameCatalog';
import { formatDate, formatNumber, safeText } from '../_lib/homePageUtils';

const CATEGORY_LABELS = Object.fromEntries(BOARD_CATEGORIES.map((item) => [item.value, item.label]));

function postAuthor(post) {
  return safeText(
    post?.authorName || post?.author?.nickname || post?.authorId?.nickname || post?.author?.username || post?.authorId?.username,
    '익명',
  );
}

export function PostRows({ posts, empty }) {
  if (!posts.length) return <p className="ui-empty">{empty}</p>;

  return (
    <ul className="ui-list">
      {posts.map((post) => {
        const category = CATEGORY_LABELS[post?.category] || '';
        const comments = Number(post?.commentCount || 0);
        return (
          <li key={`post-${post._id || post.title}`}>
            <Link href={`/board/${post._id}`} className="ui-list-row">
              <span className="ui-list-row__main">
                <strong>
                  {post.isNotice ? <em className="ui-tag ui-tag--signal">공지</em> : null}
                  {!post.isNotice && category ? <em className="ui-tag">{category}</em> : null}
                  {safeText(post.title, '제목 없음')}
                </strong>
                <span>
                  {postAuthor(post)} · {formatDate(post.createdAt) || '날짜 없음'}
                  {comments > 0 ? ` · 댓글 ${formatNumber(comments)}` : ''}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function roomHref(room) {
  const href = String(room?.href || '');
  if (href.startsWith('/')) return href;
  return room?.roomType === 'game-room' ? `/games/rooms/${room._id}` : `/twenty-questions/${room._id}`;
}

function roomMeta(room) {
  if (room?.roomType === 'game-room') {
    const title = findGameBySlug(room.gameSlug)?.title || '게임방';
    return `${title} · ${formatNumber(room.playerCount)}/${formatNumber(room.maxPlayers || 1)}명`;
  }
  const used = Number(room?.attemptCount != null ? room.attemptCount : Number(room?.questionCount || 0) + Number(room?.guessCount || 0));
  return `스무고개 · ${formatNumber(used)}/${formatNumber(room?.maxQuestions || 20)}회 사용`;
}

export function RoomRows({ rooms, empty }) {
  if (!rooms.length) return <p className="ui-empty">{empty}</p>;

  return (
    <ul className="ui-list">
      {rooms.map((room) => (
        <li key={`room-${room._id || room.title}`}>
          <Link href={roomHref(room)} className="ui-list-row">
            <span className="ui-list-row__main">
              <strong>{safeText(room.title, '제목 없음')}</strong>
              <span>{roomMeta(room)} · {safeText(room.hostName, '익명')}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RankingRows({ rows, empty, renderValue, renderName, renderSub, renderHref }) {
  if (!rows.length) return <p className="ui-empty">{empty}</p>;

  return (
    <ol className="ui-list">
      {rows.slice(0, 5).map((row, index) => {
        const name = renderName(row);
        const href = renderHref?.(row) || '';
        const sub = renderSub?.(row) || '';
        const body = (
          <>
            <span className={`ui-rank ${index === 0 ? 'ui-rank--1' : ''}`}>{index + 1}</span>
            <span className="ui-list-row__main">
              <strong>{name}</strong>
              {sub ? <span>{sub}</span> : null}
            </span>
            <span className="ui-list-row__value">{renderValue(row)}</span>
          </>
        );
        return (
          <li key={`${name}-${index}`}>
            {href ? <Link href={href} className="ui-list-row">{body}</Link> : <div className="ui-list-row">{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}
