'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../../../utils/client-auth';
import { findGameBySlug, gameDetailHref } from '../../_lib/gameCatalog';

function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw == null ? '' : String(raw);
}

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(value) {
  if (value === 'open') return '모집 중';
  if (value === 'playing') return '진행 중';
  if (value === 'finished') return '완료';
  if (value === 'closed') return '종료';
  return '대기';
}

function playerStatusLabel(value) {
  if (value === 'ready') return '준비';
  if (value === 'left') return '퇴장';
  return '참가';
}

function userIdOf(value) {
  return String(value?._id || value?.id || value?.userId || value || '');
}

export default function GameRoomDetailPage() {
  const params = useParams();
  const id = normalizeRouteId(params?.id);
  const hydrated = useHydrated();
  const token = useAuthToken();
  const user = useAuthUser();
  const router = useRouter();
  const { showToast } = useToast();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const game = findGameBySlug(room?.gameSlug);
  const currentUserId = userIdOf(user);
  const currentPlayer = useMemo(() => (
    Array.isArray(room?.players)
      ? room.players.find((player) => String(player.userId || player.user?._id || '') === currentUserId)
      : null
  ), [currentUserId, room?.players]);
  const currentReady = currentPlayer?.status === 'ready';
  const active = room && !['finished', 'closed'].includes(room.status);
  const playHref = room?.gameSlug === 'dual-academy-tcg'
    ? `/games/dual-academy-tcg/play?roomId=${id}`
    : game?.primaryHref || '';

  const loadRoom = useCallback(async () => {
    if (!id || !hydrated) return;
    if (!token) {
      setRoom(null);
      setError('게임방에 입장하려면 로그인이 필요합니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await apiGet(`/game-rooms/${id}`, { timeoutMs: 12000 });
      setRoom(payload?.room || null);
    } catch (err) {
      const message = err?.message || '게임방 정보를 불러오지 못했습니다.';
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [hydrated, id, showToast, token]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  const runAction = async (key, path, body = {}) => {
    if (!token || busy) return;
    setBusy(key);
    setError('');
    try {
      const payload = await apiPost(`/game-rooms/${id}/${path}`, body, { timeoutMs: 15000 });
      clearApiGetCache('/game-rooms');
      setRoom(payload?.room || null);
      showToast({ tone: 'success', message: payload?.message || '처리했습니다.' });
    } catch (err) {
      const message = err?.message || '요청에 실패했습니다.';
      setError(message);
      showToast({ tone: 'danger', message });
    } finally {
      setBusy('');
    }
  };

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page game-room-detail-page">
        <section className="games-hero">
          <div>
            <p className="games-kicker">Game Room</p>
            <h1>{room?.title || '게임방'}</h1>
            <p>{game?.title || room?.gameSlug || '게임'} 로비입니다. 참가자 준비 상태와 방 진행 상태를 관리합니다.</p>
          </div>
          <div className="games-hero-actions">
            <button type="button" onClick={() => void loadRoom()} disabled={loading || !token}>
              {loading ? '갱신 중...' : '새로고침'}
            </button>
            <Link href={`/games/rooms${room?.gameSlug ? `?gameSlug=${room.gameSlug}` : ''}`}>방 목록</Link>
            {game ? <Link href={gameDetailHref(game)}>게임 상세</Link> : <Link href="/games">게임 허브</Link>}
            {playHref ? <Link href={playHref}>게임으로 이동</Link> : null}
          </div>
        </section>

        {error ? <div className="games-empty games-error">{error}</div> : null}
        {!token && hydrated ? (
          <div className="games-empty">
            <span>로그인 후 게임방에 참가할 수 있습니다.</span>
            <button type="button" onClick={() => router.push('/login')}>로그인</button>
          </div>
        ) : null}

        {loading ? <div className="games-empty">게임방을 불러오는 중입니다.</div> : null}
        {!loading && token && !room && !error ? <div className="games-empty">게임방을 찾을 수 없습니다.</div> : null}

        {room ? (
          <>
            <section className="games-summary" aria-label="게임방 요약">
              <div className="games-metric">
                <span>상태</span>
                <strong>{statusLabel(room.status)}</strong>
              </div>
              <div className="games-metric">
                <span>참가자</span>
                <strong>{Number(room.playerCount || 0)}/{Number(room.maxPlayers || 0)}</strong>
              </div>
              <div className="games-metric">
                <span>리비전</span>
                <strong>{Number(room.revision || 0)}</strong>
              </div>
              <div className="games-metric">
                <span>최근 갱신</span>
                <strong>{formatDate(room.lastActivityAt || room.updatedAt)}</strong>
              </div>
            </section>

            <section className="games-detail-grid">
              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>방 조작</h2>
                  <span>{room.mode || '모드 미지정'}</span>
                </div>
                <div className="game-room-action-grid">
                  {!room.isParticipant && active ? (
                    <button type="button" onClick={() => runAction('join', 'join')} disabled={Boolean(busy)}>
                      {busy === 'join' ? '참가 중...' : '참가'}
                    </button>
                  ) : null}
                  {room.isParticipant && active ? (
                    <button type="button" onClick={() => runAction('ready', 'ready', { status: currentReady ? 'joined' : 'ready' })} disabled={Boolean(busy)}>
                      {currentReady ? '준비 취소' : '준비'}
                    </button>
                  ) : null}
                  {room.isParticipant && active ? (
                    <button type="button" onClick={() => runAction('leave', 'leave')} disabled={Boolean(busy)}>
                      나가기
                    </button>
                  ) : null}
                  {room.isHost && room.status === 'open' ? (
                    <button type="button" onClick={() => runAction('start', 'status', { status: 'playing' })} disabled={Boolean(busy)}>
                      시작
                    </button>
                  ) : null}
                  {room.isHost && room.status === 'playing' ? (
                    <button type="button" onClick={() => runAction('finish', 'status', { status: 'finished' })} disabled={Boolean(busy)}>
                      완료
                    </button>
                  ) : null}
                  {room.isHost && active ? (
                    <button type="button" className="is-danger" onClick={() => runAction('close', 'status', { status: 'closed' })} disabled={Boolean(busy)}>
                      종료
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="games-panel">
                <div className="games-panel-title">
                  <h2>방 정보</h2>
                  <span>{room.visibility === 'private' ? '비공개' : '공개'}</span>
                </div>
                <dl className="game-room-info-list">
                  <div><dt>게임</dt><dd>{game?.title || room.gameSlug}</dd></div>
                  <div><dt>방장</dt><dd>{room.hostName || '방장'}</dd></div>
                  <div><dt>상태 데이터</dt><dd>{Number(room.stateBytes || 0).toLocaleString('ko-KR')} B</dd></div>
                  <div><dt>생성</dt><dd>{formatDate(room.createdAt)}</dd></div>
                </dl>
              </section>
            </section>

            <section className="games-panel">
              <div className="games-panel-title">
                <h2>참가자</h2>
                <span>{Number(room.playerCount || 0)}명</span>
              </div>
              <div className="game-room-player-list">
                {room.players.map((player) => (
                  <article className={`game-room-player is-${player.status}`} key={`${player.userId}-${player.joinedAt}`}>
                    <strong>{player.displayName || player.user?.displayName || '사용자'}</strong>
                    <span>{player.role === 'host' ? '방장' : '참가자'}</span>
                    <em>{playerStatusLabel(player.status)}</em>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
