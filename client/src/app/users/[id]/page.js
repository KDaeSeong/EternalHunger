'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiGetCached } from '../../../utils/api';

const CATEGORY_LABELS = {
  free: '자유',
  guide: '공략',
  feedback: '피드백',
  bug: '버그',
  simulation: '시뮬레이션',
  game: '게임',
  character: '캐릭터',
  item: '아이템',
};

const ROOM_STATUS_LABELS = {
  active: '진행 중',
  solved: '정답 공개',
  closed: '종료',
};

function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw == null ? '' : String(raw);
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
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
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProfile(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const user = src.user && typeof src.user === 'object' ? src.user : null;
  return {
    user,
    summary: src.summary && typeof src.summary === 'object' ? src.summary : {},
    recentPosts: normalizeList(src.recentPosts),
    recentRooms: normalizeList(src.recentRooms),
    topCharacters: normalizeList(src.topCharacters),
    topTeams: normalizeList(src.topTeams),
  };
}

function RecordMiniTable({ rows, type }) {
  const title = type === 'teams' ? '상위 팀 전적' : '상위 캐릭터 전적';
  if (!rows.length) {
    return (
      <section className="profile-panel">
        <div className="profile-panel-title">
          <h2>{title}</h2>
        </div>
        <div className="profile-empty">아직 표시할 전적이 없습니다.</div>
      </section>
    );
  }

  return (
    <section className="profile-panel">
      <div className="profile-panel-title">
        <h2>{title}</h2>
      </div>
      <div className="profile-record-list">
        {rows.map((row) => {
          const name = type === 'teams'
            ? safeText(row.teamName || normalizeList(row.rosterNames).join(' / '), '이름 없는 팀')
            : safeText(row.name, '이름 없는 캐릭터');
          const subtitle = type === 'teams'
            ? normalizeList(row.rosterNames).join(' · ')
            : safeText(row.weaponType, '무기 미설정');
          return (
            <article className="profile-record-card" key={row._id || row.teamKey || name}>
              <div className="profile-record-name">
                {type === 'characters' && row.previewImage ? (
                  <span className="profile-avatar" style={{ backgroundImage: `url("${row.previewImage}")` }} />
                ) : (
                  <span className="profile-avatar">{name.slice(0, 1).toUpperCase()}</span>
                )}
                <span>
                  <strong>{name}</strong>
                  <small>{subtitle || '정보 없음'}</small>
                </span>
              </div>
              <dl className="profile-record-stats">
                <div><dt>참가</dt><dd>{formatNumber(row.gamesPlayed)}</dd></div>
                <div><dt>승리</dt><dd>{formatNumber(row.totalWins)}</dd></div>
                <div><dt>승률</dt><dd>{formatRate(row.winRate)}</dd></div>
                <div><dt>KDA</dt><dd>{Number(row.kda || 0).toFixed(2)}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const id = normalizeRouteId(params?.id);
  const { showToast } = useToast();
  const [profile, setProfile] = useState(() => normalizeProfile(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    if (!id) {
      setProfile(normalizeProfile(null));
      setError('사용자 ID가 없습니다.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiGetCached(`/public/users/${id}`, {
        ttlMs: 30000,
        timeoutMs: 15000,
        storage: 'session',
      });
      setProfile(normalizeProfile(data));
    } catch (err) {
      const message = err?.message || '사용자 프로필을 불러오지 못했습니다.';
      setProfile(normalizeProfile(null));
      setError(message);
      showToast({ tone: 'danger', message });
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const user = profile.user;
  const stats = user?.statistics || {};
  const winRate = Number(stats.totalGames || 0) > 0
    ? Number(stats.totalWins || 0) / Number(stats.totalGames || 1)
    : 0;
  const displayName = safeText(user?.displayName || user?.nickname || user?.username, '사용자');
  const badges = useMemo(() => normalizeList(user?.badges).filter((badge) => safeText(badge?.name)), [user?.badges]);

  return (
    <main className="profile-page-shell">
      <SiteHeader />
      <section className="profile-page">
        {loading ? (
          <div className="profile-empty">프로필을 불러오는 중입니다.</div>
        ) : error || !user ? (
          <div className="profile-empty">
            <strong>프로필을 표시할 수 없습니다.</strong>
            <p>{error || '사용자를 찾을 수 없습니다.'}</p>
            <Link href="/board">게시판으로</Link>
          </div>
        ) : (
          <>
            <section className="profile-hero">
              <div className="profile-hero-avatar">{displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <p className="profile-kicker">User Profile</p>
                <h1>{displayName}</h1>
                <span>{user.username ? `@${user.username}` : '아이디 없음'} · 가입일 {formatDate(user.createdAt) || '-'}</span>
              </div>
            </section>

            <section className="profile-stats" aria-label="사용자 요약">
              <div><span>LP</span><strong>{formatNumber(user.lp)}</strong></div>
              <div><span>전적</span><strong>{formatNumber(stats.totalGames)}전</strong><small>승률 {formatRate(winRate)}</small></div>
              <div><span>게시글</span><strong>{formatNumber(profile.summary.postCount)}</strong><small>댓글 {formatNumber(profile.summary.commentCount)}</small></div>
              <div><span>스무고개</span><strong>{formatNumber(profile.summary.hostedRoomCount)}방</strong><small>해결 {formatNumber(profile.summary.solvedHostedRoomCount)}</small></div>
            </section>

            {badges.length ? (
              <section className="profile-panel profile-badges">
                <div className="profile-panel-title"><h2>배지</h2></div>
                <div>
                  {badges.map((badge) => <span key={`${badge.name}-${badge.unlockedAt || ''}`}>{badge.name}</span>)}
                </div>
              </section>
            ) : null}

            <div className="profile-grid">
              <section className="profile-panel">
                <div className="profile-panel-title">
                  <h2>최근 게시글</h2>
                  <Link href="/board">게시판</Link>
                </div>
                {profile.recentPosts.length ? (
                  <div className="profile-link-list">
                    {profile.recentPosts.map((post) => (
                      <Link href={`/board/${post._id}`} key={post._id}>
                        <strong>{safeText(post.title, '제목 없음')}</strong>
                        <span>
                          {post.isNotice ? '공지 · ' : ''}
                          {CATEGORY_LABELS[post.category] || post.category || '자유'} · 댓글 {formatNumber(post.commentCount)} · {formatDate(post.createdAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : <div className="profile-empty compact">작성한 게시글이 없습니다.</div>}
              </section>

              <section className="profile-panel">
                <div className="profile-panel-title">
                  <h2>스무고개 방</h2>
                  <Link href="/twenty-questions">스무고개</Link>
                </div>
                {profile.recentRooms.length ? (
                  <div className="profile-link-list">
                    {profile.recentRooms.map((room) => (
                      <Link href={`/twenty-questions/${room._id}`} key={room._id}>
                        <strong>{safeText(room.title, '제목 없음')}</strong>
                        <span>
                          {ROOM_STATUS_LABELS[room.status] || room.status || '진행 중'} · 질문 {formatNumber(room.questionCount)} · 시도 {formatNumber(room.guessCount)}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : <div className="profile-empty compact">개설한 스무고개 방이 없습니다.</div>}
              </section>
            </div>

            <div className="profile-grid">
              <RecordMiniTable rows={profile.topCharacters} type="characters" />
              <RecordMiniTable rows={profile.topTeams} type="teams" />
            </div>
          </>
        )}
      </section>
    </main>
  );
}
