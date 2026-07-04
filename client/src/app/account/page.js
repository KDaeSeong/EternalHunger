'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import UserFollowPreview from '../../components/UserFollowPreview';
import { apiGetCached, apiPost, apiPut, clearApiGetCache, clearAuth, updateStoredUser } from '../../utils/api';
import { useAuthUser, useHydrated } from '../../utils/client-auth';

const EMPTY_ACTIVITY = {
  user: null,
  summary: {},
  recentPosts: [],
  recentComments: [],
  recentRooms: [],
  topCharacters: [],
  topTeams: [],
  social: { followers: [], following: [] },
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
    recentComments: normalizeList(src.recentComments),
    recentRooms: normalizeList(src.recentRooms),
    topCharacters: normalizeList(src.topCharacters),
    topTeams: normalizeList(src.topTeams),
    social: {
      followers: normalizeList(src.social?.followers),
      following: normalizeList(src.social?.following),
    },
  };
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR');
}

function formatRoomAttemptMeta(room) {
  const questionCount = Number(room?.questionCount || 0);
  const guessCount = Number(room?.guessCount || 0);
  const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : questionCount + guessCount);
  return `사용 ${formatNumber(attemptCount)}/${formatNumber(room?.maxQuestions || 20)} · 질문 ${formatNumber(questionCount)} · 시도 ${formatNumber(guessCount)}`;
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
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuthUser();
  const { showToast } = useToast();
  const [draftNickname, setDraftNickname] = useState(null);
  const [draftBio, setDraftBio] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [recoveryForm, setRecoveryForm] = useState({ currentPassword: '' });
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [deactivateForm, setDeactivateForm] = useState({ currentPassword: '', confirmText: '' });
  const [deactivateSaving, setDeactivateSaving] = useState(false);
  const [deactivateMessage, setDeactivateMessage] = useState('');
  const [activity, setActivity] = useState(() => normalizeActivity(null));
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  const currentNickname = cleanNickname(user?.nickname);
  const nicknameValue = draftNickname === null ? currentNickname : draftNickname;
  const nextNickname = cleanNickname(nicknameValue);
  const currentBio = String(user?.profileBio || '');
  const bioValue = draftBio === null ? currentBio : draftBio;
  const nextBio = String(bioValue || '').trim();
  const isDirty = nextNickname !== currentNickname || nextBio !== currentBio;
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

  const saveProfile = async (event) => {
    event.preventDefault();
    if (saving || !user) return;

    if (nextNickname.length < 2 || nextNickname.length > 20) {
      const nextMessage = '닉네임은 2~20자로 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    if (nextBio.length > 240) {
      const nextMessage = '소개는 240자 이내로 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const res = await apiPut('/user/profile', { nickname: nextNickname, profileBio: nextBio });
      const nextUser = res?.user || { ...user, nickname: nextNickname, profileBio: nextBio };
      updateStoredUser((current) => ({ ...(current || {}), ...nextUser }));
      setDraftNickname(nextUser.nickname || nextNickname);
      setDraftBio(nextUser.profileBio || '');
      const nextUserId = getUserId(nextUser) || userId;
      if (nextUserId) clearApiGetCache(`/public/users/${nextUserId}`);
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/search');
      const nextMessage = res?.message || '프로필을 저장했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      void loadActivity({ force: true });
    } catch (err) {
      const nextMessage = err?.message || '프로필 저장에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (passwordSaving || !user) return;

    const currentPassword = String(passwordForm.currentPassword || '');
    const newPassword = String(passwordForm.newPassword || '');
    const confirmPassword = String(passwordForm.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      const nextMessage = '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      const nextMessage = '새 비밀번호는 6~72자로 입력해주세요.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }
    if (newPassword !== confirmPassword) {
      const nextMessage = '새 비밀번호 확인이 일치하지 않습니다.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }
    if (currentPassword === newPassword) {
      const nextMessage = '새 비밀번호는 현재 비밀번호와 달라야 합니다.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage('');
    try {
      const res = await apiPut('/user/password', { currentPassword, newPassword });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      const nextMessage = res?.message || '비밀번호를 변경했습니다.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
    } catch (err) {
      const nextMessage = err?.message || '비밀번호 변경에 실패했습니다.';
      setPasswordMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setPasswordSaving(false);
    }
  };

  const issueRecoveryCode = async (event) => {
    event.preventDefault();
    if (recoverySaving || !user) return;

    const currentPassword = String(recoveryForm.currentPassword || '');
    if (!currentPassword) {
      const nextMessage = '현재 비밀번호를 입력해주세요.';
      setRecoveryMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setRecoverySaving(true);
    setRecoveryMessage('');
    setRecoveryCode('');
    try {
      const res = await apiPost('/user/recovery-code', { currentPassword }, { timeoutMs: 20000 });
      const nextUser = res?.user || {};
      setRecoveryForm({ currentPassword: '' });
      setRecoveryCode(res?.recoveryCode || '');
      updateStoredUser((current) => ({ ...(current || {}), ...nextUser }));
      const nextMessage = res?.message || '복구 코드를 발급했습니다.';
      setRecoveryMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
    } catch (err) {
      const nextMessage = err?.message || '복구 코드 발급에 실패했습니다.';
      setRecoveryMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setRecoverySaving(false);
    }
  };

  const deactivateAccount = async (event) => {
    event.preventDefault();
    if (deactivateSaving || !user) return;

    const currentPassword = String(deactivateForm.currentPassword || '');
    const confirmText = String(deactivateForm.confirmText || '').trim();

    if (!currentPassword) {
      const nextMessage = '현재 비밀번호를 입력해주세요.';
      setDeactivateMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }
    if (confirmText !== '탈퇴') {
      const nextMessage = '확인 문구에 탈퇴를 입력해주세요.';
      setDeactivateMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    const ok = window.confirm('계정을 탈퇴 처리하면 다시 로그인할 수 없습니다. 계속하시겠습니까?');
    if (!ok) return;

    setDeactivateSaving(true);
    setDeactivateMessage('');
    try {
      const res = await apiPost('/user/deactivate', { currentPassword, confirmText }, { timeoutMs: 20000 });
      const nextMessage = res?.message || '계정이 탈퇴 처리되었습니다.';
      setDeactivateMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      clearAuth();
      router.replace('/');
    } catch (err) {
      const nextMessage = err?.message || '계정 탈퇴 처리에 실패했습니다.';
      setDeactivateMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setDeactivateSaving(false);
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

            <form className="account-panel account-security-panel" onSubmit={savePassword}>
              <div className="account-panel-title">
                <h2>보안</h2>
              </div>
              <div className="account-security-grid">
                <label className="account-field">
                  <span>현재 비밀번호</span>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                    autoComplete="current-password"
                    disabled={passwordSaving}
                  />
                </label>
                <label className="account-field">
                  <span>새 비밀번호</span>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={72}
                    disabled={passwordSaving}
                  />
                </label>
                <label className="account-field">
                  <span>새 비밀번호 확인</span>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={72}
                    disabled={passwordSaving}
                  />
                </label>
              </div>
              {passwordMessage ? <div className="account-message">{passwordMessage}</div> : null}
              <div className="account-actions">
                <button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </form>

            <form className="account-panel account-recovery-panel" onSubmit={issueRecoveryCode}>
              <div className="account-panel-title">
                <h2>비밀번호 복구 코드</h2>
                <Link href="/reset-password">재설정 화면</Link>
              </div>
              <p>
                이메일 없이 비밀번호를 재설정할 때 쓰는 1회용 코드입니다. 새 코드를 발급하면 이전 코드는 무효화됩니다.
              </p>
              {user?.recoveryCodeCreatedAt ? (
                <div className="account-recovery-status">
                  활성 복구 코드 발급일: {formatDate(user.recoveryCodeCreatedAt) || '날짜 없음'}
                </div>
              ) : (
                <div className="account-recovery-status">아직 활성 복구 코드가 없습니다.</div>
              )}
              <div className="account-security-grid compact">
                <label className="account-field">
                  <span>현재 비밀번호</span>
                  <input
                    type="password"
                    value={recoveryForm.currentPassword}
                    onChange={(event) => setRecoveryForm({ currentPassword: event.target.value })}
                    autoComplete="current-password"
                    disabled={recoverySaving}
                  />
                </label>
              </div>
              {recoveryCode ? (
                <div className="account-recovery-code" aria-live="polite">
                  <span>새 복구 코드</span>
                  <strong>{recoveryCode}</strong>
                  <small>이 코드는 다시 표시되지 않습니다. 지금 안전한 곳에 보관해주세요.</small>
                </div>
              ) : null}
              {recoveryMessage ? <div className="account-message">{recoveryMessage}</div> : null}
              <div className="account-actions">
                <button type="submit" disabled={recoverySaving}>
                  {recoverySaving ? '발급 중...' : '복구 코드 발급'}
                </button>
              </div>
            </form>

            <form className="account-panel account-danger-panel" onSubmit={deactivateAccount}>
              <div className="account-panel-title">
                <h2>계정 탈퇴</h2>
              </div>
              <p>
                탈퇴하면 현재 계정으로 다시 로그인할 수 없습니다. 작성한 게시글과 기록은 서비스 흐름 보존을 위해
                남지만, 계정명과 프로필 정보는 탈퇴 계정으로 정리됩니다.
              </p>
              <div className="account-security-grid">
                <label className="account-field">
                  <span>현재 비밀번호</span>
                  <input
                    type="password"
                    value={deactivateForm.currentPassword}
                    onChange={(event) => setDeactivateForm({ ...deactivateForm, currentPassword: event.target.value })}
                    autoComplete="current-password"
                    disabled={deactivateSaving}
                  />
                </label>
                <label className="account-field">
                  <span>확인 문구</span>
                  <input
                    value={deactivateForm.confirmText}
                    onChange={(event) => setDeactivateForm({ ...deactivateForm, confirmText: event.target.value })}
                    placeholder="탈퇴"
                    disabled={deactivateSaving}
                  />
                </label>
              </div>
              {deactivateMessage ? <div className="account-message danger">{deactivateMessage}</div> : null}
              <div className="account-actions">
                <button type="submit" className="danger" disabled={deactivateSaving}>
                  {deactivateSaving ? '처리 중...' : '계정 탈퇴'}
                </button>
              </div>
            </form>

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
