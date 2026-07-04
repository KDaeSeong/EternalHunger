'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiGetCached } from '../../../utils/api';
import { findGameBySlug, GAME_CATALOG, gameDetailHref } from '../_lib/gameCatalog';

const EMPTY_HUB = {
  counts: {
    users: 0,
    posts: 0,
    characters: 0,
    teams: 0,
    runs: 0,
    rooms: 0,
    activeRooms: 0,
    solvedRooms: 0,
    closedRooms: 0,
    visibleRooms: 0,
  },
  recentPosts: [],
  activeRooms: [],
  recentRooms: [],
  recentRuns: [],
  rankings: { points: [], characters: [], teams: [] },
};

function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw == null ? '' : String(raw);
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeHub(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const rankings = src.rankings && typeof src.rankings === 'object' ? src.rankings : {};
  return {
    counts: { ...EMPTY_HUB.counts, ...(src.counts || {}) },
    recentPosts: normalizeList(src.recentPosts),
    activeRooms: normalizeList(src.activeRooms),
    recentRooms: normalizeList(src.recentRooms),
    recentRuns: normalizeList(src.recentRuns),
    rankings: {
      points: normalizeList(rankings.points),
      characters: normalizeList(rankings.characters),
      teams: normalizeList(rankings.teams),
    },
  };
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
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

function formatPercent(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '0%';
  return `${Math.round(n * 100)}%`;
}

function roomStatusLabel(value) {
  if (value === 'solved') return '정답';
  if (value === 'closed') return '종료';
  return '진행';
}

function metricValueForKey(key, hub) {
  const topUser = hub.rankings.points[0] || null;
  if (key === 'characters') return hub.counts.characters;
  if (key === 'teams') return hub.counts.teams;
  if (key === 'runs') return hub.counts.runs;
  if (key === 'posts') return hub.counts.posts;
  if (key === 'topLp') return topUser?.lp || 0;
  if (key === 'rooms') return hub.counts.rooms;
  if (key === 'activeRooms') return hub.counts.activeRooms;
  if (key === 'solvedRooms') return hub.counts.solvedRooms;
  if (key === 'visibleRooms') return hub.counts.visibleRooms || hub.activeRooms.length;
  return 0;
}

function metricLabelForKey(key) {
  if (key === 'characters') return '캐릭터';
  if (key === 'teams') return '팀 전적';
  if (key === 'runs') return '저장 경기';
  if (key === 'posts') return '게시글';
  if (key === 'topLp') return '최고 LP';
  if (key === 'rooms') return '전체 방';
  if (key === 'activeRooms') return '진행 중';
  if (key === 'solvedRooms') return '정답 방';
  if (key === 'visibleRooms') return '표시 방';
  return '지표';
}

function GameMetric({ label, value }) {
  return (
    <div className="games-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function ActivityPanel({ title, href, items, empty, renderItem, linkLabel = '전체 보기' }) {
  return (
    <section className="games-panel">
      <div className="games-panel-title">
        <h2>{title}</h2>
        <Link href={href}>{linkLabel}</Link>
      </div>
      {items.length ? <div className="games-activity-list">{items.map(renderItem)}</div> : <div className="games-empty">{empty}</div>}
    </section>
  );
}

export default function GameDetailPage() {
  const params = useParams();
  const slug = normalizeRouteId(params?.slug);
  const game = findGameBySlug(slug);
  const { showToast } = useToast();
  const [hub, setHub] = useState(EMPTY_HUB);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHub = useCallback(async (options = {}) => {
    if (!game) return;
    setLoading(true);
    setError('');
    try {
      const payload = await apiGetCached(`/public/games/${game.slug}/hub`, {
        ttlMs: 30000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setHub(normalizeHub(payload));
    } catch (err) {
      const message = err?.message || '게임 상세 정보를 불러오지 못했습니다.';
      setHub(EMPTY_HUB);
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [game, showToast]);

  useEffect(() => {
    if (game) void loadHub();
    else setLoading(false);
  }, [game, loadHub]);

  const relevantPosts = useMemo(() => {
    if (!game) return [];
    return hub.recentPosts.slice(0, 6);
  }, [game, hub.recentPosts]);

  const relatedGames = useMemo(() => GAME_CATALOG.filter((row) => row.slug !== slug), [slug]);

  if (!game) {
    return (
      <main className="games-page-shell">
        <SiteHeader />
        <section className="games-page">
          <div className="games-empty games-error">
            <span>게임을 찾을 수 없습니다.</span>
            <Link href="/games">게임 허브로 이동</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page">
        <section className={`games-detail-hero is-${game.tone}`}>
          {game.visual === 'map' ? <div className="games-detail-visual" aria-hidden="true" /> : null}
          <div className="games-detail-copy">
            <p className="games-kicker">{game.subtitle}</p>
            <h1>{game.title}</h1>
            <p>{game.detail}</p>
            <div className="games-hero-actions">
              <Link href={game.primaryHref}>{game.primaryLabel}</Link>
              <Link href={`/games/rooms?gameSlug=${game.slug}`}>게임방</Link>
              <Link href={game.boardHref}>{game.boardLabel}</Link>
              <Link href={game.recordHref}>{game.recordLabel}</Link>
              <Link href={game.guideHref}>{game.guideLabel}</Link>
            </div>
          </div>
        </section>

        <section className="games-summary" aria-label="게임 상세 요약">
          {game.metrics.map((key) => (
            <GameMetric key={key} label={metricLabelForKey(key)} value={metricValueForKey(key, hub)} />
          ))}
          <GameMetric label="회원" value={hub.counts.users} />
        </section>

        {error ? (
          <div className="games-empty games-error">
            <span>{error}</span>
            <button type="button" onClick={() => void loadHub({ force: true })}>다시 불러오기</button>
          </div>
        ) : null}

        <section className="games-detail-grid">
          <section className="games-panel">
            <div className="games-panel-title">
              <h2>플레이 흐름</h2>
              <Link href={game.primaryHref}>시작</Link>
            </div>
            <div className="games-step-list">
              {game.statusItems.map((item, index) => (
                <div key={item}>
                  <span>{index + 1}</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>바로가기</h2>
              <Link href="/games">게임 허브</Link>
            </div>
            <div className="games-link-grid">
              <Link href={game.primaryHref}>{game.primaryLabel}</Link>
              <Link href={game.boardHref}>{game.boardLabel}</Link>
              <Link href={game.recordHref}>{game.recordLabel}</Link>
              <Link href={game.guideHref}>{game.guideLabel}</Link>
            </div>
          </section>
        </section>

        <section className="games-dashboard">
          {game.isRoadmap ? (
            <ActivityPanel
              title="이식 논의"
              href={game.boardHref}
              items={relevantPosts}
              empty={loading ? '관련 글을 불러오는 중입니다.' : '아직 이식 논의 글이 없습니다.'}
              renderItem={(post) => (
                <Link href={`/board/${post._id}`} key={`roadmap-post-${post._id || post.title}`}>
                  <strong>{safeText(post.title, '제목 없음')}</strong>
                  <span>{safeText(post.authorName, '익명')} · 조회 {formatNumber(post.viewCount)} · 추천 {formatNumber(post.reactionCount)} · {formatDate(post.createdAt || post.updatedAt) || '-'}</span>
                </Link>
              )}
            />
          ) : game.slug === 'twenty-questions' ? (
            <>
              <ActivityPanel
                title="진행 중인 방"
                href="/twenty-questions"
                items={hub.activeRooms.slice(0, 6)}
                empty={loading ? '방 정보를 불러오는 중입니다.' : '진행 중인 방이 없습니다.'}
                renderItem={(room) => {
                  const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : Number(room?.questionCount || 0) + Number(room?.guessCount || 0));
                  return (
                    <Link href={`/twenty-questions/${room._id}`} key={`room-${room._id || room.title}`}>
                      <strong>{safeText(room.title, '제목 없음')}</strong>
                      <span>{safeText(room.hostName, '익명')} · {formatNumber(attemptCount)}/{formatNumber(room.maxQuestions || 20)} · {safeText(room.categoryLabel, room.category || '자유')}</span>
                    </Link>
                  );
                }}
              />
              <ActivityPanel
                title="최근 방"
                href="/twenty-questions"
                items={hub.recentRooms.slice(0, 6)}
                empty={loading ? '최근 방을 불러오는 중입니다.' : '표시할 방이 없습니다.'}
                renderItem={(room) => {
                  const attemptCount = Number(room?.attemptCount != null ? room.attemptCount : Number(room?.questionCount || 0) + Number(room?.guessCount || 0));
                  return (
                    <Link href={`/twenty-questions/${room._id}`} key={`recent-room-${room._id || room.title}`}>
                      <strong>{safeText(room.title, '제목 없음')}</strong>
                      <span>{roomStatusLabel(room.status)} · {safeText(room.hostName, '익명')} · {formatNumber(attemptCount)}/{formatNumber(room.maxQuestions || 20)}</span>
                    </Link>
                  );
                }}
              />
            </>
          ) : (
            <>
              <ActivityPanel
                title="최근 경기"
                href="/records"
                items={hub.recentRuns.slice(0, 6)}
                empty={loading ? '최근 경기를 불러오는 중입니다.' : '저장된 경기 기록이 없습니다.'}
                renderItem={(run) => (
                  <Link href="/records" key={`run-${run._id || run.playedAt || run.title}`}>
                    <strong>{safeText(run.winnerTeamName || run.winnerName || run.title, '승자 미기록')}</strong>
                    <span>{formatDate(run.playedAt) || '-'} · 킬 {formatNumber(run.totalKills)} · 부활 {formatNumber(run.totalRevives)} · 초월 {formatNumber(run.transCount)}</span>
                  </Link>
                )}
              />
              <ActivityPanel
                title="상위 캐릭터"
                href="/leaderboard"
                items={hub.rankings.characters.slice(0, 6)}
                empty={loading ? '캐릭터 랭킹을 불러오는 중입니다.' : '표시할 캐릭터 전적이 없습니다.'}
                linkLabel="랭킹"
                renderItem={(row) => (
                  <Link href="/leaderboard" key={`char-rank-${row._id || row.name}`}>
                    <strong>{safeText(row.name, '이름 없음')}</strong>
                    <span>{safeText(row.ownerName, '익명')} · 승 {formatNumber(row.totalWins)} · 킬 {formatNumber(row.totalKills)} · 승률 {formatPercent(row.winRate)}</span>
                  </Link>
                )}
              />
              <ActivityPanel
                title="상위 팀"
                href="/leaderboard"
                items={hub.rankings.teams.slice(0, 6)}
                empty={loading ? '팀 랭킹을 불러오는 중입니다.' : '표시할 팀 전적이 없습니다.'}
                linkLabel="랭킹"
                renderItem={(row) => (
                  <Link href="/leaderboard" key={`team-rank-${row._id || row.teamKey || row.teamName}`}>
                    <strong>{safeText(row.teamName || row.rosterNames?.join(' / '), '팀 이름 없음')}</strong>
                    <span>{safeText(row.ownerName, '익명')} · 승 {formatNumber(row.totalWins)} · 킬 {formatNumber(row.totalKills)} · 승률 {formatPercent(row.winRate)}</span>
                  </Link>
                )}
              />
            </>
          )}

          {!game.isRoadmap ? (
          <ActivityPanel
            title="최근 관련 글"
            href={game.boardHref}
            items={relevantPosts}
            empty={loading ? '게시글을 불러오는 중입니다.' : '표시할 게시글이 없습니다.'}
            renderItem={(post) => (
              <Link href={`/board/${post._id}`} key={`post-${post._id || post.title}`}>
                <strong>{safeText(post.title, '제목 없음')}</strong>
                <span>{safeText(post.authorName, '익명')} · 조회 {formatNumber(post.viewCount)} · 추천 {formatNumber(post.reactionCount)} · {formatDate(post.createdAt || post.updatedAt) || '-'}</span>
              </Link>
            )}
          />
          ) : null}

          <section className="games-panel">
            <div className="games-panel-title">
              <h2>다른 게임</h2>
              <Link href="/games">목록</Link>
            </div>
            <div className="games-related-list">
              {relatedGames.map((row) => (
                <Link href={gameDetailHref(row)} key={row.slug}>
                  <span>{row.subtitle}</span>
                  <strong>{row.title}</strong>
                  <small>{row.summary}</small>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
