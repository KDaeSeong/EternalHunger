'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached, apiPut, clearApiGetCache, updateStoredUser } from '../../utils/api';
import { useAuthUser, useHydrated } from '../../utils/client-auth';

const EMPTY_ACTIVITY = {
  user: null,
  summary: {},
  recentPosts: [],
  recentRooms: [],
  topCharacters: [],
  topTeams: [],
};

const CATEGORY_LABELS = {
  free: '자유',
  guide: '공략',
  feedback: '피드백',
  bug: '버그',
  simulation: '시뮬레이션',
  game: '게임',
};

const ROOM_STATUS_LABELS = {
  active: '진행 중',
  solved: '정답 공개',
  closed: '종료',
};

function cleanNickname(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function getDisplayName(user) {
  return cleanNickname(user?.displayName) || cleanNickname(user?.nickname) || cleanNickname(user?.username) || '사용자';
}

function getUserId(user) {
  return user?._id || user?.id || user?.userId || '';
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeActivity(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  return {
    user: src.user && typeof src.user === 'object' ? src.user : null,
    summary: src.summary && typeof src.summary === 'object' ? src.summary : {},
    recentPosts: normalizeList(src.recentPosts),
    recentRooms: normalizeList(src.recentRooms),
    topCharacters: normalizeList(src.topCharacters),
    topTeams: normalizeList(src.topTeams),
  };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatRate(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
}

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

export default function AccountPage() {
  const hydrated = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();
  const [draftNickname, setDraftNickname] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activity, setActivity] = useState(() => normalizeActivity(null));
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  const currentNickname = cleanNickname(user?.nickname);
  const nicknameValue = draftNickname === null ? currentNickname : draftNickname;
  const nextNickname = cleanNickname(nicknameValue);
  const isDirty = nextNickname !== currentNickname;
  const userId = getUserId(user);

  const loadActivity = useCallback(async (options = {}) => {
    if (!userId) {
      setActivity(normalizeActivity(null));
      setActivityError('');
      setActivityLoading(false);
      return;
    }

    setActivityLoading(true);
    setActivityError('');
    try {
      const data = await apiGetCached(`/public/users/${userId}`, {
        ttlMs: 30000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setActivity(normalizeActivity(data));
    } catch (err) {
      const nextMessage = err?.message || '내 활동 정보를 불러오지 못했습니다.';
      setActivity(normalizeActivity(null));
      setActivityError(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
    } finally {
      setActivityLoading(false);
    }
  }, [showToast, userId]);

  useEffect(() => {
    if (!hydrated || !userId) {
      setActivity(normalizeActivity(null));
      return;
    }
    void loadActivity();
  }, [hydrated, loadActivity, userId]);

  const publicProfileHref = userId ? `/users/${userId}` : '';
  const activityUser = activity.user || user;
  const stats = activityUser?.statistics || {};
  const totalGames = Number(stats.totalGames || 0);
  const winRate = totalGames > 0 ? Number(stats.totalWins || 0) / totalGames : 0;
  const summary = activity.summary || {};
  const badges = useMemo(() => normalizeList(activityUser?.badges).filter((badge) => safeText(badge?.name)), [activityUser?.badges]);

  const saveNickname = async (event) => {
    event.preventDefault();
    if (saving || !user) return;

    if (nextNickname.length < 2 || nextNickname.length > 20) {
      const nextMessage = '닉네임은 2~20자로 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await apiPut('/user/nickname', { nickname: nextNickname });
      const nextUser = res?.user || { ...user, nickname: nextNickname };
      updateStoredUser((current) => ({ ...(current || {}), ...nextUser }));
      setDraftNickname(nextUser.nickname || nextNickname);
      const nextUserId = getUserId(nextUser) || userId;
      if (nextUserId) clearApiGetCache(`/public/users/${nextUserId}`);
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/search');
      const nextMessage = res?.message || '닉네임을 저장했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      void loadActivity({ force: true });
    } catch (err) {
      const nextMessage = err?.message || '닉네임 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="account-page-shell">
      <SiteHeader />
      <section className="account-page">
        <div className="account-head">
          <div>
            <p className="account-kicker">Account</p>
            <h1>계정 설정</h1>
          </div>
          {hydrated && publicProfileHref ? <Link href={publicProfileHref}>내 공개 프로필</Link> : null}
        </div>

        {!hydrated ? (
          <div className="account-panel">계정 정보를 확인하는 중입니다.</div>
        ) : !user ? (
          <div className="account-panel account-login-panel">
            <p>로그인하면 닉네임을 설정할 수 있습니다.</p>
            <Link href="/login">로그인</Link>
          </div>
        ) : (
          <>
            <div className="account-dashboard">
              <form className="account-panel account-form" onSubmit={saveNickname}>
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
                  <Link href="/simulation">게임 시작</Link>
                  <Link href="/characters">캐릭터 설정</Link>
                  <Link href="/board">게시판</Link>
                  <Link href="/bookmarks">저장글</Link>
                  <Link href="/twenty-questions">스무고개</Link>
                  <Link href="/reports">신고 내역</Link>
                </div>
              </section>
            </div>

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
                  <h2>스무고개 방</h2>
                  <Link href="/twenty-questions">방 목록</Link>
                </div>
                {activity.recentRooms.length ? (
                  <div className="account-link-list">
                    {activity.recentRooms.map((room) => (
                      <Link href={`/twenty-questions/${room._id}`} key={room._id}>
                        <strong>{safeText(room.title, '제목 없음')}</strong>
                        <span>{ROOM_STATUS_LABELS[room.status] || room.status || '진행 중'} · 질문 {formatNumber(room.questionCount)} · 시도 {formatNumber(room.guessCount)}</span>
                      </Link>
                    ))}
                  </div>
                ) : <div className="account-empty compact">개설한 스무고개 방이 없습니다.</div>}
              </section>

              <section className="account-panel">
                <div className="account-panel-title">
                  <h2>상위 캐릭터</h2>
                  <Link href="/records">기록소</Link>
                </div>
                <AccountRecordRows rows={activity.topCharacters} type="character" />
              </section>

              <section className="account-panel">
                <div className="account-panel-title">
                  <h2>상위 팀</h2>
                  <Link href="/records">기록소</Link>
                </div>
                <AccountRecordRows rows={activity.topTeams} type="team" />
              </section>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
