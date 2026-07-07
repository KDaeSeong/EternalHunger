import Link from 'next/link';
import { formatNumber, formatRate, getDisplayName } from '../_lib/accountUtils';

export default function AccountProfileDashboard(props) {
  const {
    activityError,
    activityLoading,
    activityUser,
    badges,
    bioValue,
    isDirty,
    message,
    nextBio,
    nicknameValue,
    publicProfileHref,
    saveProfile,
    saving,
    setDraftBio,
    setDraftNickname,
    summary,
    totalGames,
    user,
    winRate,
  } = props;

  return (
    <>
            <div className="account-dashboard">
              <form className="account-panel account-form" onSubmit={saveProfile}>
                <div className="account-summary">
                  <span>현재 표시명</span>
                  <strong>{getDisplayName(user)}</strong>
                  <small>아이디: {user.username || '-'}</small>
                </div>

                <label className="account-field">
                  <span>닉네임</span>
                  <input
                    value={nicknameValue}
                    onChange={(event) => setDraftNickname(event.target.value)}
                    placeholder="2~20자"
                    maxLength={20}
                    disabled={saving}
                  />
                </label>

                <label className="account-field">
                  <span>소개</span>
                  <textarea
                    value={bioValue}
                    onChange={(event) => setDraftBio(event.target.value)}
                    placeholder="공개 프로필에 표시할 짧은 소개"
                    maxLength={240}
                    rows={4}
                    disabled={saving}
                  />
                  <small>{nextBio.length}/240</small>
                </label>

                {message ? <div className="account-message">{message}</div> : null}

                <div className="account-actions">
                  <button type="submit" disabled={saving || !isDirty}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </form>

              <section className="account-panel account-overview">
                <div className="account-panel-title">
                  <h2>내 요약</h2>
                  {publicProfileHref ? <Link href={publicProfileHref}>공개 프로필</Link> : null}
                </div>
                {activityLoading ? <div className="account-empty compact">내 활동 정보를 불러오는 중입니다.</div> : null}
                {activityError ? <div className="account-message">{activityError}</div> : null}
                <div className="account-overview-stats">
                  <div><span>LP</span><strong>{formatNumber(activityUser?.lp)}</strong></div>
                  <div><span>크레딧</span><strong>{formatNumber(user?.credits)}</strong></div>
                  <div><span>전적</span><strong>{formatNumber(totalGames)}전</strong><small>승률 {formatRate(winRate)}</small></div>
                  <div><span>게시글</span><strong>{formatNumber(summary.postCount)}</strong><small>댓글 {formatNumber(summary.commentCount)}</small></div>
                </div>
                {badges.length ? (
                  <div className="account-badge-list">
                    {badges.slice(0, 8).map((badge) => <span key={`${badge.name}-${badge.unlockedAt || ''}`}>{badge.name}</span>)}
                  </div>
                ) : null}
                <div className="account-quick-actions">
                  <Link href="/eternalhunger">게임 시작</Link>
                  <Link href="/characters">캐릭터 설정</Link>
                  <Link href="/board">게시판</Link>
                  <Link href="/bookmarks">저장글</Link>
                  <Link href="/twenty-questions">스무고개</Link>
                  <Link href="/reports">신고 내역</Link>
                </div>
              </section>
            </div>

    </>
  );
}
