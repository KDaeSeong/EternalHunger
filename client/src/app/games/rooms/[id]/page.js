'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import GameRoomOverviewPanels from '../_components/GameRoomOverviewPanels';
import GameRoomPlayersPanel from '../_components/GameRoomPlayersPanel';
import GameRoomRecordPanel from '../_components/GameRoomRecordPanel';
import GameRoomSavePanels from '../_components/GameRoomSavePanels';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiGetCached, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../../../utils/client-auth';
import {
  activeRoomPlayers,
  buildDefaultRecordForm,
  buildDefaultSaveForm,
  buildRoomRecordPayload,
  buildRoomSavePayload,
  cleanSlotKey,
  findDynamicGameCandidate,
  isRoomSaveSlot,
  normalizeList,
  normalizeRouteId,
  safeText,
  userIdOf,
} from '../_lib/gameRoomDetailUtils';
import { findGameBySlug, gameDetailHref } from '../../_lib/gameCatalog';

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
  const [saveForm, setSaveForm] = useState(() => buildDefaultSaveForm(null));
  const [recordForm, setRecordForm] = useState(() => buildDefaultRecordForm(null));
  const [restoreSlots, setRestoreSlots] = useState([]);
  const [restoreSlotId, setRestoreSlotId] = useState('');
  const [restoreLoadedFor, setRestoreLoadedFor] = useState('');
  const [dynamicGame, setDynamicGame] = useState(null);

  const staticGame = useMemo(() => findGameBySlug(room?.gameSlug), [room?.gameSlug]);
  const game = staticGame || dynamicGame;
  const currentUserId = userIdOf(user);
  const roomPlayers = useMemo(() => activeRoomPlayers(room), [room]);
  const currentPlayer = useMemo(() => (
    Array.isArray(room?.players)
      ? room.players.find((player) => String(player.userId || player.user?._id || '') === currentUserId)
      : null
  ), [currentUserId, room]);
  const currentReady = currentPlayer?.status === 'ready';
  const active = room && !['finished', 'closed'].includes(room.status);
  const canSaveRoom = Boolean(room && (room.isParticipant || room.isHost));
  const canRestoreRoom = Boolean(canSaveRoom && active);
  const canRecordResult = Boolean(room?.isHost && !room?.recordedAt && roomPlayers.length);
  const playHref = room?.gameSlug === 'dual-academy-tcg'
    ? `/myanime/dual-academy-tcg/play?roomId=${id}`
    : room?.gameSlug === 'ba-vanguard'
      ? `/myanime/ba-vanguard/play?roomId=${id}`
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
    void Promise.resolve().then(loadRoom);
  }, [loadRoom]);

  useEffect(() => {
    let cancelled = false;
    const slug = String(room?.gameSlug || '').trim();
    if (!slug || staticGame) {
      void Promise.resolve().then(() => {
        if (!cancelled) setDynamicGame(null);
      });
      return () => {
        cancelled = true;
      };
    }

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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [room?.gameSlug, staticGame]);

  useEffect(() => {
    if (!room?._id) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setSaveForm((current) => (
        current.roomId === room._id ? current : buildDefaultSaveForm(room)
      ));
      setRecordForm((current) => (
        current.roomId === room._id ? current : buildDefaultRecordForm(room)
      ));
    });
    return () => {
      cancelled = true;
    };
  }, [room, setRecordForm, setSaveForm]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setRestoreSlots([]);
      setRestoreSlotId('');
      setRestoreLoadedFor('');
    });
    return () => {
      cancelled = true;
    };
  }, [room?._id, setRestoreLoadedFor, setRestoreSlotId, setRestoreSlots]);

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

  const saveRoomSnapshot = async (event) => {
    event?.preventDefault();
    if (!token || busy || !room) return;
    const gameSlug = safeText(room.gameSlug, '');
    const slotKey = cleanSlotKey(saveForm.slotKey, 'room-save');
    if (!gameSlug || !slotKey) {
      const message = '게임과 슬롯 키가 필요합니다.';
      setError(message);
      showToast({ tone: 'warning', message });
      return;
    }

    setBusy('save-slot');
    setError('');
    try {
      const payload = buildRoomSavePayload(room, { ...saveForm, slotKey });
      const res = await apiPut(`/game-saves/${gameSlug}/${slotKey}`, payload, { timeoutMs: 20000 });
      clearApiGetCache('/game-saves');
      setSaveForm((current) => ({ ...current, slotKey }));
      showToast({ tone: 'success', message: res?.message || '방 상태를 저장 슬롯에 저장했습니다.' });
    } catch (err) {
      const message = err?.message || '방 상태 저장에 실패했습니다.';
      setError(message);
      showToast({ tone: 'danger', message });
    } finally {
      setBusy('');
    }
  };

  const loadRestoreSlots = async () => {
    if (!token || busy || !room?.gameSlug) return;
    setBusy('load-saves');
    setError('');
    try {
      const data = await apiGet(`/game-saves?gameSlug=${room.gameSlug}`, { timeoutMs: 15000 });
      const slots = normalizeList(data?.saves).filter(isRoomSaveSlot);
      setRestoreSlots(slots);
      setRestoreSlotId((current) => (
        current && slots.some((slot) => slot.id === current)
          ? current
          : slots[0]?.id || ''
      ));
      setRestoreLoadedFor(room._id || room.id || '');
      showToast({
        tone: slots.length ? 'success' : 'warning',
        message: slots.length ? '저장 슬롯을 불러왔습니다.' : '복원할 방 저장 슬롯이 없습니다.',
      });
    } catch (err) {
      const message = err?.message || '저장 슬롯을 불러오지 못했습니다.';
      setError(message);
      showToast({ tone: 'danger', message });
    } finally {
      setBusy('');
    }
  };

  const restoreRoomSnapshot = async () => {
    if (!token || busy || !room || !restoreSlotId) return;
    setBusy('restore-slot');
    setError('');
    try {
      const detail = await apiGet(`/game-saves/${restoreSlotId}`, { timeoutMs: 15000 });
      const save = detail?.save || {};
      const payload = save.payload && typeof save.payload === 'object' ? save.payload : {};
      if (save.gameSlug && save.gameSlug !== room.gameSlug) {
        throw new Error('현재 방과 다른 게임의 저장 슬롯입니다.');
      }
      if (payload.source !== 'game-room') {
        throw new Error('게임방 상태 저장 슬롯만 복원할 수 있습니다.');
      }
      const state = payload.state && typeof payload.state === 'object' ? payload.state : {};
      const settings = payload.settings && typeof payload.settings === 'object' ? payload.settings : {};
      const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
      const res = await apiPost(`/game-rooms/${id}/state`, {
        state,
        settings,
        summary,
        revision: Number(room.revision || 0),
      }, { timeoutMs: 20000 });
      clearApiGetCache('/game-rooms');
      setRoom(res?.room || room);
      showToast({ tone: 'success', message: '저장 슬롯에서 방 상태를 복원했습니다.' });
    } catch (err) {
      const nextRoom = err?.response?.data?.room;
      if (nextRoom) setRoom(nextRoom);
      const message = err?.message || '방 상태 복원에 실패했습니다.';
      setError(message);
      showToast({ tone: 'danger', message });
    } finally {
      setBusy('');
    }
  };

  const recordRoomResult = async (event) => {
    event?.preventDefault();
    if (!token || busy || !room) return;
    setBusy('record');
    setError('');
    try {
      const payload = await apiPost(`/game-rooms/${id}/records`, buildRoomRecordPayload(room, recordForm), { timeoutMs: 15000 });
      clearApiGetCache('/game-rooms');
      clearApiGetCache('/game-records');
      clearApiGetCache(`/public/games/${room.gameSlug}/hub`);
      setRoom(payload?.room || room);
      showToast({ tone: 'success', message: payload?.message || '방 결과를 기록했습니다.' });
    } catch (err) {
      const nextRoom = err?.response?.data?.room;
      if (nextRoom) setRoom(nextRoom);
      const message = err?.message || '방 결과 기록에 실패했습니다.';
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
            <GameRoomOverviewPanels
              active={active}
              busy={busy}
              canSaveRoom={canSaveRoom}
              currentReady={currentReady}
              game={game}
              room={room}
              runAction={runAction}
            />

            <GameRoomSavePanels
              busy={busy}
              canRestoreRoom={canRestoreRoom}
              canSaveRoom={canSaveRoom}
              game={game}
              loadRestoreSlots={loadRestoreSlots}
              restoreLoadedFor={restoreLoadedFor}
              restoreRoomSnapshot={restoreRoomSnapshot}
              restoreSlotId={restoreSlotId}
              restoreSlots={restoreSlots}
              room={room}
              saveForm={saveForm}
              saveRoomSnapshot={saveRoomSnapshot}
              setRestoreSlotId={setRestoreSlotId}
              setSaveForm={setSaveForm}
            />

            <GameRoomRecordPanel
              busy={busy}
              canRecordResult={canRecordResult}
              game={game}
              recordForm={recordForm}
              recordRoomResult={recordRoomResult}
              room={room}
              roomPlayers={roomPlayers}
              setRecordForm={setRecordForm}
            />

            <GameRoomPlayersPanel
              game={game}
              room={room}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}
