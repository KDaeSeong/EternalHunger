'use client';

import Link from 'next/link';

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

function normalizeEntry(entry) {
  const user = entry?.user && typeof entry.user === 'object' ? entry.user : null;
  const id = safeText(user?._id || user?.id, '');
  if (!id) return null;
  const displayName = safeText(user?.displayName || user?.nickname || user?.username, '사용자');
  return {
    id,
    href: `/users/${id}`,
    displayName,
    username: safeText(user?.username, ''),
    lp: Number(user?.lp || 0),
    followedAt: entry?.followedAt || '',
    viewerFollowing: Boolean(entry?.viewerFollowing),
  };
}

function UserRow({ entry }) {
  return (
    <Link href={entry.href} className="follow-preview-row">
      <span className="follow-preview-avatar">{entry.displayName.slice(0, 1).toUpperCase()}</span>
      <span className="follow-preview-main">
        <strong>{entry.displayName}</strong>
        <small>
          {entry.username ? `@${entry.username} · ` : ''}
          {formatNumber(entry.lp)} LP
          {entry.followedAt ? ` · ${formatDate(entry.followedAt)}` : ''}
        </small>
      </span>
      {entry.viewerFollowing ? <b>팔로잉</b> : null}
    </Link>
  );
}

function FollowGroup({ title, count, entries, emptyText }) {
  const rows = normalizeList(entries).map(normalizeEntry).filter(Boolean);
  return (
    <div className="follow-preview-group">
      <div className="follow-preview-group-title">
        <h3>{title}</h3>
        <span>{formatNumber(count)}</span>
      </div>
      {rows.length ? (
        <div className="follow-preview-list">
          {rows.map((entry) => <UserRow entry={entry} key={`${title}-${entry.id}`} />)}
        </div>
      ) : (
        <div className="follow-preview-empty">{emptyText}</div>
      )}
    </div>
  );
}

export default function UserFollowPreview({
  followers = [],
  following = [],
  followerCount = 0,
  followingCount = 0,
  panelClassName = 'profile-panel',
}) {
  return (
    <section className={`${panelClassName} follow-preview-panel`}>
      <div className="follow-preview-title">
        <h2>팔로우 네트워크</h2>
        <Link href="/activity">활동 피드</Link>
      </div>
      <div className="follow-preview-grid">
        <FollowGroup
          title="팔로워"
          count={followerCount}
          entries={followers}
          emptyText="아직 팔로워가 없습니다."
        />
        <FollowGroup
          title="팔로잉"
          count={followingCount}
          entries={following}
          emptyText="아직 팔로우한 유저가 없습니다."
        />
      </div>
    </section>
  );
}
