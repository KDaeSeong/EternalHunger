'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiGetCached, apiPost, clearApiGetCache } from '../../../utils/api';
import { useAuthToken, useHydrated } from '../../../utils/client-auth';
import {
  dynamicGameCandidateToGame,
  findGameBySlug,
  gameDetailHref,
  getAllGames,
  getGameIntegration,
  getGameRoomOptions,
} from '../_lib/gameCatalog';

const STATUS_OPTIONS = [
  { value: '', label: '진행 가능' },
  { value: 'open', label: '모집 중' },
  { value: 'playing', label: '진행 중' },
  { value: 'finished', label: '완료' },
  { value: 'closed', label: '종료' },
];

const ROOM_GAME_OPTIONS = getGameRoomOptions();
const DEFAULT_ROOM_GAME_SLUG = ROOM_GAME_OPTIONS[0]?.slug || 'dual-academy-tcg';
const DEFAULT_ROOM_INTEGRATION = getGameIntegration(DEFAULT_ROOM_GAME_SLUG);
const DEFAULT_ROOM_MAX_PLAYERS = DEFAULT_ROOM_INTEGRATION.maxPlayers || 4;

function mergeGamesBySlug(baseGames, extraGames) {
  const bySlug = new Map();
  [...baseGames, ...extraGames].forEach((game) => {
    if (game?.slug && !bySlug.has(game.slug)) bySlug.set(game.slug, game);
  });
  return Array.from(bySlug.values());
}

function isRoomEnabledGameSlug(slug, options = ROOM_GAME_OPTIONS) {
  return options.some((game) => game.slug === slug);
}

function normalizeDynamicGames(payload) {
  return normalizeList(payload?.candidates).map(dynamicGameCandidateToGame).filter(Boolean);
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
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

function gameTitle(slug, gameBySlug = new Map()) {
  return gameBySlug.get(slug)?.title || findGameBySlug(slug)?.title || slug || '게임';
}

function GameRoomsContent() {
  const hydrated = useHydrated();
  const token = useAuthToken();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const initialGameSlug = searchParams.get('gameSlug') || '';
  const [gameSlug, setGameSlug] = useState(initialGameSlug);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dynamicGames, setDynamicGames] = useState([]);
  const [showCreate, setShowCreate] = useState(searchParams.get('create') === '1');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    gameSlug: isRoomEnabledGameSlug(initialGameSlug) ? initialGameSlug : DEFAULT_ROOM_GAME_SLUG,
    title: '',
    mode: '',
    maxPlayers: DEFAULT_ROOM_MAX_PLAYERS,
  });

  const gameOptions = useMemo(() => mergeGamesBySlug(getAllGames(), dynamicGames), [dynamicGames]);
  const roomGameOptions = useMemo(
    () => mergeGamesBySlug(
      ROOM_GAME_OPTIONS,
      dynamicGames.filter((game) => game?.integration?.roomSystem === 'game-room'),
    ),
    [dynamicGames],
  );
  const gameBySlug = useMemo(() => new Map(gameOptions.map((game) => [game.slug, game])), [gameOptions]);
  const roomGameBySlug = useMemo(() => new Map(roomGameOptions.map((game) => [game.slug, game])), [roomGameOptions]);
  const selectedGame = gameBySlug.get(gameSlug) || findGameBySlug(gameSlug);
  const selectedRoomGame = roomGameBySlug.get(form.gameSlug) || findGameBySlug(form.gameSlug);
  const selectedRoomIntegration = getGameIntegration(selectedRoomGame || form.gameSlug);

  const loadGameCandidates = useCallback(async () => {
    try {
      const payload = await apiGetCached('/public/game-candidates', {
        ttlMs: 30000,
        timeoutMs: 15000,
        storage: 'session',
      });
      setDynamicGames(normalizeDynamicGames(payload));
    } catch {
      setDynamicGames([]);
    }
  }, []);

  const loadRooms = useCallback(async (options = {}) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (gameSlug) params.set('gameSlug', gameSlug);
      if (status) params.set('status', status);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const payload = await apiGetCached(`/game-rooms${suffix}`, {
        ttlMs: 8000,
        timeoutMs: 12000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setRooms(normalizeList(payload?.rooms));
    } catch (err) {
      const message = err?.message || '게임방 목록을 불러오지 못했습니다.';
      setError(message);
      showToast({ tone: 'warning', message });
    } finally {
      setLoading(false);
    }
  }, [gameSlug, showToast, status]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    void loadGameCandidates();
  }, [loadGameCandidates]);

  useEffect(() => {
    const requested = String(initialGameSlug || '').trim();
    if (!requested || !isRoomEnabledGameSlug(requested, roomGameOptions)) return;
    setForm((current) => {
      if (current.gameSlug === requested || current.gameSlug !== DEFAULT_ROOM_GAME_SLUG) return current;
      const game = roomGameBySlug.get(requested) || requested;
      const integration = getGameIntegration(game);
      const minPlayers = Number(integration.minPlayers || 1);
      const maxPlayers = Number(integration.maxPlayers || 64);
      const nextMaxPlayers = Math.max(minPlayers, Math.min(maxPlayers, Number(current.maxPlayers || maxPlayers)));
      return { ...current, gameSlug: requested, maxPlayers: nextMaxPlayers };
    });
  }, [initialGameSlug, roomGameBySlug, roomGameOptions]);

  const updateForm = (key, value) => {
    setForm((current) => {
      if (key !== 'gameSlug') return { ...current, [key]: value };
      const integration = getGameIntegration(roomGameBySlug.get(value) || value);
      const minPlayers = Number(integration.minPlayers || 1);
      const maxPlayers = Number(integration.maxPlayers || 64);
      const nextMaxPlayers = Math.max(minPlayers, Math.min(maxPlayers, Number(current.maxPlayers || maxPlayers)));
      return { ...current, gameSlug: value, maxPlayers: nextMaxPlayers };
    });
  };

  const createRoom = async () => {
    if (!token || creating) return;
    const title = safeText(form.title, `${gameTitle(form.gameSlug, gameBySlug)} 방`);
    const minPlayers = Number(selectedRoomIntegration.minPlayers || 1);
    const maxPlayers = Number(selectedRoomIntegration.maxPlayers || 64);
    const nextMaxPlayers = Math.max(minPlayers, Math.min(maxPlayers, Number(form.maxPlayers || maxPlayers)));
    setCreating(true);
    try {
      const payload = await apiPost('/game-rooms', {
        gameSlug: form.gameSlug,
        title,
        mode: form.mode,
        maxPlayers: nextMaxPlayers,
        summary: {
          gameTitle: gameTitle(form.gameSlug, gameBySlug),
          adapter: selectedRoomIntegration.adapter,
          stage: selectedRoomIntegration.stage,
          resultMode: selectedRoomIntegration.resultMode,
        },
        settings: {
          adapter: selectedRoomIntegration.adapter,
          supportsStateSync: Boolean(selectedRoomIntegration.supportsStateSync),
          supportsRecords: Boolean(selectedRoomIntegration.supportsRecords),
        },
      }, { timeoutMs: 15000 });
      clearApiGetCache('/game-rooms');
      showToast({ tone: 'success', message: '게임방을 만들었습니다.' });
      const roomId = payload?.room?.id || payload?.room?._id;
      if (roomId) router.push(`/games/rooms/${roomId}`);
      else void loadRooms({ force: true });
    } catch (err) {
      const message = err?.message || '게임방 생성에 실패했습니다.';
      showToast({ tone: 'danger', message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="games-page-shell">
      <SiteHeader />
      <section className="games-page game-rooms-page">
        <section className="games-hero">
          <div>
            <p className="games-kicker">Game Rooms</p>
            <h1>게임방</h1>
            <p>이식할 게임들이 공통으로 사용할 방 목록입니다. 모집, 참가, 준비, 시작 상태를 여기에서 관리합니다.</p>
          </div>
          <div className="games-hero-actions">
            <button type="button" onClick={() => void loadRooms({ force: true })} disabled={loading}>
              {loading ? '갱신 중...' : '새로고침'}
            </button>
            {token ? (
              <button type="button" onClick={() => setShowCreate((value) => !value)}>
                {showCreate ? '닫기' : '방 만들기'}
              </button>
            ) : (
              <Link href="/login">로그인</Link>
            )}
            <Link href="/games">게임 허브</Link>
          </div>
        </section>

        <section className="game-room-toolbar" aria-label="게임방 필터">
          <select value={gameSlug} onChange={(event) => setGameSlug(event.target.value)}>
            <option value="">전체 게임</option>
            {gameOptions.map((game) => (
              <option value={game.slug} key={game.slug}>{game.title}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option value={option.value} key={option.value || 'active'}>{option.label}</option>
            ))}
          </select>
          {selectedGame ? <Link href={gameDetailHref(selectedGame)}>선택 게임 상세</Link> : null}
        </section>

        {showCreate && token ? (
          <section className="games-panel game-room-create-panel">
            <div className="games-panel-title">
              <h2>새 게임방</h2>
              <span>방장으로 참가합니다.</span>
            </div>
            <div className="game-room-create-grid">
              <label>
                <span>게임</span>
                <select value={form.gameSlug} onChange={(event) => updateForm('gameSlug', event.target.value)}>
                  {roomGameOptions.map((game) => (
                    <option value={game.slug} key={game.slug}>{game.title}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>방 제목</span>
                <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="방 제목" maxLength={120} />
              </label>
              <label>
                <span>모드</span>
                <input value={form.mode} onChange={(event) => updateForm('mode', event.target.value)} placeholder="예: 친선전, 랭크, 테스트" maxLength={80} />
              </label>
              <label>
                <span>정원</span>
                <input type="number" min={selectedRoomIntegration.minPlayers || 1} max={selectedRoomIntegration.maxPlayers || 64} value={form.maxPlayers} onChange={(event) => updateForm('maxPlayers', event.target.value)} />
              </label>
            </div>
            <p className="game-room-adapter-note">
              {selectedRoomGame?.title || form.gameSlug} · {selectedRoomIntegration.stageLabel} · {selectedRoomIntegration.adapter}
              {selectedRoomIntegration.supportsStateSync ? ' · 상태 동기화' : ''}
              {selectedRoomIntegration.supportsRecords ? ' · 전적 기록' : ''}
            </p>
            <button type="button" className="tcg-primary-action" onClick={createRoom} disabled={creating || !hydrated}>
              {creating ? '생성 중...' : '방 생성'}
            </button>
          </section>
        ) : null}

        {error ? <div className="games-empty games-error">{error}</div> : null}

        <section className="game-room-grid" aria-label="게임방 목록">
          {loading ? <div className="games-empty">게임방을 불러오는 중입니다.</div> : null}
          {!loading && !error && rooms.length === 0 ? <div className="games-empty">표시할 게임방이 없습니다.</div> : null}
          {!loading && rooms.map((room) => (
            <Link href={`/games/rooms/${room.id || room._id}`} className="game-room-card" key={room.id || room._id}>
              <div className="game-room-card__top">
                <span className={`game-room-status is-${room.status}`}>{statusLabel(room.status)}</span>
                <span>{gameTitle(room.gameSlug, gameBySlug)}</span>
              </div>
              <h2>{safeText(room.title, '게임방')}</h2>
              <p>{safeText(room.mode, '모드 미지정')}</p>
              <div className="game-room-card__meta">
                <span>방장 {safeText(room.hostName, '방장')}</span>
                <span>{Number(room.playerCount || 0)}/{Number(room.maxPlayers || 0)}명</span>
                <span>rev {Number(room.revision || 0)}</span>
              </div>
              <small>{formatDate(room.lastActivityAt || room.updatedAt || room.createdAt)}</small>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}

export default function GameRoomsPage() {
  return (
    <Suspense fallback={(
      <main className="games-page-shell">
        <SiteHeader />
        <section className="games-page game-rooms-page">
          <div className="games-empty">게임방을 불러오는 중입니다.</div>
        </section>
      </main>
    )}>
      <GameRoomsContent />
    </Suspense>
  );
}
