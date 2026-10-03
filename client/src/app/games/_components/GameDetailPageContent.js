'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import { useAuthUser } from '../../../utils/client-auth';
import { useToast } from '../../../components/ToastProvider';
import { apiGetCached } from '../../../utils/api';
import {
  findGameBySlug,
  gameDetailHref,
  gameRoomCreateHref,
  getAllGames,
  getGameRouteFamily,
  getGamePortingChecklist,
} from '../_lib/gameCatalog';
import { getGamePortingProgress } from '../_lib/gamePortingProgress.mjs';
import { gameDisplayTitle, gameTagline } from '../_lib/gameTaglines';
import { gamePlayHref } from './GamesHubCards';

import { ActivityPanel, GameMetric } from './GameDetailPanels';
import GameIcon from './GameIcon';
import GameKeyArt, { gameKeyArtSrc } from './GameKeyArt';
import {
  EMPTY_HUB,
  findDynamicGameCandidate,
  formatDate,
  formatNumber,
  formatPercent,
  metricLabelForKey,
  metricValueForKey,
  normalizeHub,
  normalizeRouteId,
  roomHref,
  roomMeta,
  roomStatusLabel,
  runHref,
  runMeta,
  runTitle,
  safeText,
} from '../_lib/gameDetailHelpers';

function afterRender(task) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task);
    return;
  }
  setTimeout(task, 0);
}

export default function GameDetailPageContent() {
  const params = useParams();
  const slug = normalizeRouteId(params?.slug);
  const staticGame = useMemo(() => findGameBySlug(slug), [slug]);
  const { showToast } = useToast();
  const viewer = useAuthUser();
  const [hub, setHub] = useState(EMPTY_HUB);
  const [dynamicGame, setDynamicGame] = useState(null);
  const [dynamicLookupDone, setDynamicLookupDone] = useState(Boolean(staticGame));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const game = staticGame || dynamicGame;
  const keyArtSrc = gameKeyArtSrc(game?.slug);
  const resolvingGame = !staticGame && !dynamicLookupDone;

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
    let cancelled = false;
    if (!slug || staticGame) {
      afterRender(() => {
        if (cancelled) return;
        setDynamicGame(null);
        setDynamicLookupDone(true);
      });
      return () => {
        cancelled = true;
      };
    }

    afterRender(() => {
      if (cancelled) return;
      setDynamicGame(null);
      setDynamicLookupDone(false);
    });

    (async () => {
      try {
        const payload = await apiGetCached('/public/game-candidates', {
          ttlMs: 30000,
          timeoutMs: 15000,
          storage: 'session',
        });
        if (!cancelled) setDynamicGame(findDynamicGameCandidate(payload, slug));
      } catch {
        if (!cancelled) setDynamicGame(null);
      } finally {
        if (!cancelled) setDynamicLookupDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, staticGame]);

  useEffect(() => {
    if (game) {
      afterRender(() => void loadHub());
      return;
    }
    if (!resolvingGame) {
      afterRender(() => setLoading(false));
    }
  }, [game, loadHub, resolvingGame]);

  const relevantPosts = useMemo(() => {
    if (!game) return [];
    return hub.recentPosts.slice(0, 6);
  }, [game, hub.recentPosts]);

  const routeFamily = game ? getGameRouteFamily(game) : null;
  const relatedGames = useMemo(() => {
    if (!game) return [];
    const familyKey = getGameRouteFamily(game).key;
    return getAllGames()
      .filter((row) => row.slug !== slug && getGameRouteFamily(row).key === familyKey)
      .slice(0, 6);
  }, [game, slug]);
  const integration = game?.integration || {};
  const roomSystemLabel = integration.roomSystem === 'game-room'
    ? '공용 게임방'
    : integration.roomSystem === 'twenty-questions'
      ? '전용 방'
      : '없음';
  const integrationRows = game ? [
    ['이식 단계', integration.stageLabel || integration.stage || '기획'],
    ['어댑터', integration.adapter || 'discussion'],
    ['방 시스템', roomSystemLabel],
    ['상태 동기화', integration.supportsStateSync ? '지원' : '미지원'],
    ['전적 기록', integration.supportsRecords ? '지원' : '미지원'],
    ['저장 슬롯', integration.supportsSaves ? '지원' : '미지원'],
    ['결과 처리', integration.resultMode || 'manual'],
  ] : [];
  const portingChecklist = game ? getGamePortingChecklist(game) : [];
  const portingProgress = game ? getGamePortingProgress(game) : { done: 0, total: 0, label: '0/0' };
  const integrationHref = integration.roomSystem === 'game-room' ? gameRoomCreateHref(game) : game?.primaryHref || '/games';

  if (!game && resolvingGame) {
    return (
      <main className="games-page-shell">
        <SiteHeader />
        <div className="ui-page">
          <p className="ui-empty">게임 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="games-page-shell">
        <SiteHeader />
        <div className="ui-page">
          <div className="ui-empty gd-missing">
            <p>게임을 찾을 수 없습니다. 주소를 확인하거나 게임 목록에서 골라 주세요.</p>
            <Link href="/games" className="ui-button ui-button--quiet ui-button--small">게임 목록</Link>
          </div>
        </div>
      </main>
    );
  }

  const title = gameDisplayTitle(game);
  const isEternalHunger = game.slug === 'eternal-hunger';
  const playHref = gamePlayHref(game);
  const heroMetrics = game.metrics.slice(0, 3);

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <div className="ui-page gd">
        <section className={`ui-hero ${keyArtSrc ? 'has-art' : ''}`.trim()} aria-labelledby="gd-title">
          {keyArtSrc ? (
            <GameKeyArt
              slug={game.slug}
              title={title}
              className="ui-hero__art"
              sizes="(max-width: 860px) 100vw, 55vw"
              preload
            />
          ) : (
            <span className="ui-hero__art ui-hero__art--icon">
              <GameIcon slug={game.slug} tone={game.tone} />
            </span>
          )}
          <div className="ui-hero__copy">
            {routeFamily && !isEternalHunger ? (
              <Link href={routeFamily.baseHref} className="ui-hero__family">{routeFamily.label}</Link>
            ) : null}
            <h1 id="gd-title">{title}</h1>
            <p>{gameTagline(game) || game.detail}</p>
            <div className="ui-hero__actions">
              {playHref ? (
                <Link href={playHref} className="ui-button ui-hero__play">{isEternalHunger ? '이터널 헝거 플레이' : '플레이'}</Link>
              ) : null}
              {isEternalHunger ? (
                <Link href="/characters" className="ui-button ui-hero__secondary">캐릭터 설정</Link>
              ) : integration.supportsRooms ? (
                <Link href={`/games/rooms?gameSlug=${game.slug}`} className="ui-button ui-hero__secondary">게임방</Link>
              ) : null}
              {game.recordHref ? (
                <Link href={game.recordHref} className="ui-button ui-hero__secondary">{game.recordLabel || '기록'}</Link>
              ) : null}
            </div>
            {heroMetrics.length ? (
              <dl className="ui-hero__facts">
                {heroMetrics.map((key) => (
                  <GameMetric key={key} label={metricLabelForKey(key)} value={loading || error ? null : metricValueForKey(key, hub)} />
                ))}
              </dl>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="ui-notice ui-notice--danger" role="alert">
            <span>게임 소식을 불러오지 못했습니다. {error}</span>
            <button type="button" className="ui-button ui-button--quiet ui-button--small" onClick={() => void loadHub({ force: true })}>다시 불러오기</button>
          </div>
        ) : null}

        {!game.isRoadmap && game.statusItems.length ? (
          <section className="ui-panel gd-steps" aria-labelledby="gd-steps-title">
            <div className="ui-panel__head">
              <h2 id="gd-steps-title">이렇게 진행됩니다</h2>
            </div>
            <ol>
              {game.statusItems.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </section>
        ) : null}

        <div className="gd-dashboard">
          {game.isRoadmap ? (
            <>
              <ActivityPanel
                title="진행 중인 게임방"
                href={`/games/rooms?gameSlug=${game.slug}`}
                items={hub.activeRooms.slice(0, 6)}
                empty={loading ? '게임방을 불러오는 중입니다.' : '진행 중인 게임방이 없습니다.'}
                renderItem={(room) => (
                  <Link href={roomHref(room)} key={`roadmap-room-${room._id || room.title}`}>
                    <strong>{safeText(room.title, '게임방')}</strong>
                    <span>{roomMeta(room)}</span>
                  </Link>
                )}
              />
              <ActivityPanel
                title="최근 전적"
                href={game.recordHref}
                items={hub.recentRuns.slice(0, 6)}
                empty={loading ? '최근 전적을 불러오는 중입니다.' : '아직 기록된 전적이 없습니다.'}
                renderItem={(run) => (
                  <Link href={runHref(run, game.recordHref)} key={`roadmap-run-${run._id || run.playedAt || run.title}`}>
                    <strong>{runTitle(run)}</strong>
                    <span>{runMeta(run)}</span>
                  </Link>
                )}
              />
              <ActivityPanel
                title="관련 글"
                href={game.boardHref}
                items={relevantPosts}
                empty={loading ? '관련 글을 불러오는 중입니다.' : '아직 관련 글이 없습니다.'}
                renderItem={(post) => (
                  <Link href={`/board/${post._id}`} key={`roadmap-post-${post._id || post.title}`}>
                    <strong>{safeText(post.title, '제목 없음')}</strong>
                    <span>{safeText(post.authorName, '익명')} · 조회 {formatNumber(post.viewCount)} · 추천 {formatNumber(post.reactionCount)} · {formatDate(post.createdAt || post.updatedAt) || '-'}</span>
                  </Link>
                )}
              />
            </>
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
                    <Link href={roomHref(room)} key={`room-${room._id || room.title}`}>
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
                    <Link href={roomHref(room)} key={`recent-room-${room._id || room.title}`}>
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
                title="진행 중인 게임방"
                href={`/games/rooms?gameSlug=${game.slug}`}
                items={hub.activeRooms.slice(0, 6)}
                empty={loading ? '게임방을 불러오는 중입니다.' : '진행 중인 게임방이 없습니다.'}
                renderItem={(room) => (
                  <Link href={roomHref(room)} key={`game-room-${room._id || room.title}`}>
                    <strong>{safeText(room.title, '게임방')}</strong>
                    <span>{roomMeta(room)}</span>
                  </Link>
                )}
              />
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

          {relatedGames.length ? (
            <section className="ui-panel">
              <div className="ui-panel__head">
                <h2>같은 묶음의 게임</h2>
                <Link href={routeFamily?.baseHref || '/games'}>{routeFamily?.label || '게임'} 전체</Link>
              </div>
              <ul className="ui-list gd-list">
                {relatedGames.map((row) => (
                  <li key={row.slug}>
                    <Link href={gameDetailHref(row)}>
                      <strong>{gameDisplayTitle(row)}</strong>
                      <span>{gameTagline(row) || row.subtitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {viewer?.isAdmin ? (
          <details className="ui-panel gd-dev">
            <summary>개발 정보 · 이식 준비도 {portingProgress.label}</summary>
            <div className="gd-dev__body">
              <dl className="gd-dev__grid">
                {integrationRows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <ul className="gd-dev__checklist" aria-label={`${title} 이식 체크리스트`}>
                {portingChecklist.map((entry) => (
                  <li className={entry.done ? 'is-done' : 'is-pending'} key={entry.key}>
                    <strong>{entry.label}</strong>
                    <span>{entry.done ? '연결됨' : '대기'}</span>
                    {entry.note ? <small>{entry.note}</small> : null}
                  </li>
                ))}
              </ul>
              {game.isRoadmap && game.statusItems.length ? (
                <ul className="gd-dev__notes">
                  {game.statusItems.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
              <Link href={integrationHref} className="ui-button ui-button--quiet ui-button--small">연결된 화면 열기</Link>
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
