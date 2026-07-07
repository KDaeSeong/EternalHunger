import Link from 'next/link';
import UserFollowPreview from '../../../components/UserFollowPreview';
import {
  CATEGORY_LABELS,
  ROOM_STATUS_LABELS,
  formatDate,
  formatNumber,
  formatRoomAttemptMeta,
  normalizeList,
  safeText,
} from '../_lib/accountUtils';

function AccountRecordRows({ rows, type }) {
  if (!rows.length) return <div className="account-empty compact">표시할 전적이 없습니다.</div>;

  return (
    <div className="account-record-list">
      {rows.slice(0, 4).map((row) => {
        const name = type === 'team'
          ? safeText(row.teamName || normalizeList(row.rosterNames).join(' / '), '이름 없는 팀')
          : safeText(row.name, '이름 없는 캐릭터');
        const subtitle = type === 'team'
          ? normalizeList(row.rosterNames).join(' · ')
          : safeText(row.weaponType, '무기 미설정');
        return (
          <article className="account-record-row" key={row._id || row.teamKey || name}>
            <div>
              <strong>{name}</strong>
              <small>{subtitle || '정보 없음'}</small>
            </div>
            <span>{formatNumber(row.totalWins)}승 · {formatNumber(row.totalKills)}킬</span>
          </article>
        );
      })}
    </div>
  );
}

export default function AccountActivityPanels({
  activity,
  summary,
}) {
  return (
    <>
      <UserFollowPreview
        panelClassName="account-panel account-social-panel"
        followers={activity.social.followers}
        following={activity.social.following}
        followerCount={summary.followerCount}
        followingCount={summary.followingCount}
      />

      <div className="account-activity-grid">
        <section className="account-panel">
          <div className="account-panel-title">
            <h2>최근 게시글</h2>
            <Link href="/board">게시판</Link>
          </div>
          {activity.recentPosts.length ? (
            <div className="account-link-list">
              {activity.recentPosts.map((post) => (
                <Link href={`/board/${post._id}`} key={post._id}>
                  <strong>{safeText(post.title, '제목 없음')}</strong>
                  <span>{CATEGORY_LABELS[post.category] || post.category || '자유'} · 조회 {formatNumber(post.viewCount)} · 추천 {formatNumber(post.reactionCount)} · 댓글 {formatNumber(post.commentCount)} · {formatDate(post.createdAt) || '날짜 없음'}</span>
                </Link>
              ))}
            </div>
          ) : <div className="account-empty compact">작성한 게시글이 없습니다.</div>}
        </section>

        <section className="account-panel">
          <div className="account-panel-title">
            <h2>최근 댓글</h2>
            <Link href="/board">게시판</Link>
          </div>
          {activity.recentComments.length ? (
            <div className="account-link-list">
              {activity.recentComments.map((comment) => (
                <Link href={`/board/${comment.postId}`} key={comment._id || `${comment.postId}-${comment.createdAt || ''}`}>
                  <strong>{safeText(comment.postTitle, '제목 없음')}</strong>
                  <span>{CATEGORY_LABELS[comment.postCategory] || comment.postCategory || '자유'} · {formatDate(comment.createdAt) || '날짜 없음'}</span>
                  <small>{safeText(comment.contentPreview, '내용 없음')}</small>
                </Link>
              ))}
            </div>
          ) : <div className="account-empty compact">작성한 댓글이 없습니다.</div>}
        </section>

        <section className="account-panel">
          <div className="account-panel-title">
            <h2>스무고개 방</h2>
            <Link href="/twenty-questions">방 목록</Link>
          </div>
          {activity.recentRooms.length ? (
            <div className="account-link-list">
              {activity.recentRooms.map((room) => (
                <Link href={`/twenty-questions/${room._id}`} key={room._id}>
                  <strong>{safeText(room.title, '제목 없음')}</strong>
                  <span>{ROOM_STATUS_LABELS[room.status] || room.status || '진행 중'} · {formatRoomAttemptMeta(room)}</span>
                </Link>
              ))}
            </div>
          ) : <div className="account-empty compact">개설한 스무고개 방이 없습니다.</div>}
        </section>

        <section className="account-panel">
          <div className="account-panel-title">
            <h2>상위 캐릭터</h2>
            <Link href="/records">기록실</Link>
          </div>
          <AccountRecordRows rows={activity.topCharacters} type="character" />
        </section>

        <section className="account-panel">
          <div className="account-panel-title">
            <h2>상위 팀</h2>
            <Link href="/records">기록실</Link>
          </div>
          <AccountRecordRows rows={activity.topTeams} type="team" />
        </section>
      </div>
    </>
  );
}
