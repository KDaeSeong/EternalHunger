'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../../../components/SiteHeader';
import { useToast } from '../../../../components/ToastProvider';
import { apiGet, apiPost, apiPut, clearApiGetCache } from '../../../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../../../utils/client-auth';
import { findGameBySlug, gameDetailHref } from '../../_lib/gameCatalog';

const RECORD_RESULT_OPTIONS = [
  ['none', '기록'],
  ['win', '승리'],
  ['loss', '패배'],
  ['draw', '무승부'],
  ['clear', '클리어'],
  ['fail', '실패'],
];

const ROOM_SAVE_VERSION = 'room-state-v1';

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

function cleanSlotKey(value, fallback = 'room-save') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function getPlayTimeSec(startedAt) {
  const start = new Date(startedAt || '').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

function activeRoomPlayers(room) {
  return Array.isArray(room?.players) ? room.players.filter((player) => player?.status !== 'left') : [];
}

function playerDisplayName(player) {
  return safeText(player?.displayName || player?.user?.displayName || player?.user?.nickname || player?.user?.username, '사용자');
}

function buildDefaultRecordForm(room) {
  const roomState = room?.state && typeof room.state === 'object' ? room.state : {};
  const matchState = roomState.state && typeof roomState.state === 'object' ? roomState.state : {};
  const hostId = userIdOf(room?.hostId);
  const winner = String(matchState.winner || '');
  const playTimeSec = getPlayTimeSec(matchState.startedAt || room?.startedAt || room?.createdAt);
  return {
    roomId: userIdOf(room?._id || room?.id),
    title: `${safeText(room?.title, '게임방')} 결과`,
    winnerUserId: winner === 'player' ? hostId : '',
    result: winner === 'enemy' ? 'loss' : 'none',
    score: winner === 'player' ? '100' : '0',
    playTimeSec: String(playTimeSec),
    note: '',
  };
}

function buildDefaultSaveForm(room) {
  const roomId = userIdOf(room?._id || room?.id);
  return {
    roomId,
    slotKey: cleanSlotKey(roomId ? `room-${roomId}` : 'room-save'),
    saveName: `${safeText(room?.title, '게임방')} 저장`,
    note: '',
  };
}

function buildRoomSavePayload(room, form = {}) {
  const roomState = room?.state && typeof room.state === 'object' ? room.state : {};
  const settings = room?.settings && typeof room.settings === 'object' ? room.settings : {};
  const summary = room?.summary && typeof room.summary === 'object' ? room.summary : {};
  const roomId = userIdOf(room?._id || room?.id);
  return {
    saveName: safeText(form.saveName, `${safeText(room?.title, '게임방')} 저장`),
    version: ROOM_SAVE_VERSION,
    summary: {
      source: 'game-room',
      roomId,
      roomTitle: safeText(room?.title, '게임방'),
      roomStatus: safeText(room?.status, 'open'),
      mode: safeText(room?.mode, ''),
      revision: Number(room?.revision || 0),
      playerCount: Number(room?.playerCount || 0),
      stateBytes: Number(room?.stateBytes || 0),
      note: safeText(form.note, ''),
    },
    payload: {
      source: 'game-room',
      roomId,
      gameSlug: safeText(room?.gameSlug, ''),
      roomTitle: safeText(room?.title, '게임방'),
      roomMode: safeText(room?.mode, ''),
      roomStatus: safeText(room?.status, 'open'),
      revision: Number(room?.revision || 0),
      summary,
      settings,
      state: roomState,
      savedAt: new Date().toISOString(),
    },
  };
}

function buildRoomRecordPayload(room, form = {}) {
  const roomState = room?.state && typeof room.state === 'object' ? room.state : {};
  const matchState = roomState.state && typeof roomState.state === 'object' ? roomState.state : {};
  const players = activeRoomPlayers(room);
  const hostId = userIdOf(room?.hostId);
  const winner = String(matchState.winner || '');
  const manualWinnerUserId = userIdOf(form.winnerUserId);
  const winnerUserId = manualWinnerUserId || (winner === 'player' ? hostId : '');
  const commonResult = String(form.result || (winner === 'enemy' ? 'loss' : 'none')).trim() || 'none';
  const manualScore = Number(form.score);
  const hasManualScore = Number.isFinite(manualScore);
  const resultByUserId = {};
  const scoreByUserId = {};
  const turn = Number(matchState.turn || 0);
  const playerHealth = Number(matchState.playerHealth || 0);
  const enemyHealth = Number(matchState.enemyHealth || 0);

  players.forEach((player) => {
    const playerId = userIdOf(player?.userId);
    if (!playerId) return;
    if (winnerUserId) resultByUserId[playerId] = playerId === winnerUserId ? 'win' : 'loss';
    else resultByUserId[playerId] = commonResult;
    scoreByUserId[playerId] = hasManualScore
      ? manualScore
      : resultByUserId[playerId] === 'win'
      ? 100 + Math.max(0, playerHealth) + Math.max(0, 12 - turn)
      : Math.max(0, enemyHealth);
  });

  const playTimeSec = Number(form.playTimeSec);
  return {
    title: safeText(form.title, `${safeText(room?.title, '게임방')} 결과`),
    mode: safeText(room?.mode, room?.gameSlug || ''),
    winnerUserId,
    resultByUserId,
    scoreByUserId,
    result: winnerUserId ? 'none' : commonResult,
    playTimeSec: Number.isFinite(playTimeSec) ? Math.max(0, Math.floor(playTimeSec)) : getPlayTimeSec(matchState.startedAt || room?.startedAt || room?.createdAt),
    summary: {
      deckName: roomState.deckName || '',
      turn,
      playerHealth,
      enemyHealth,
      winner: winner || 'none',
      manualWinnerUserId,
      commonResult,
      note: safeText(form.note, ''),
    },
    payload: {
      roomState,
    },
  };
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
  const [saveForm, setSaveForm] = useState(() => buildDefaultSaveForm(null));
  const [recordForm, setRecordForm] = useState(() => buildDefaultRecordForm(null));

  const game = findGameBySlug(room?.gameSlug);
  const currentUserId = userIdOf(user);
  const roomPlayers = useMemo(() => activeRoomPlayers(room), [room]);
  const currentPlayer = useMemo(() => (
    Array.isArray(room?.players)
      ? room.players.find((player) => String(player.userId || player.user?._id || '') === currentUserId)
      : null
  ), [currentUserId, room?.players]);
  const currentReady = currentPlayer?.status === 'ready';
  const active = room && !['finished', 'closed'].includes(room.status);
  const canSaveRoom = Boolean(room && (room.isParticipant || room.isHost));
  const canRecordResult = Boolean(room?.isHost && !room?.recordedAt && roomPlayers.length);
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

  useEffect(() => {
    if (!room?._id) return;
    setSaveForm((current) => (
      current.roomId === room._id ? current : buildDefaultSaveForm(room)
    ));
    setRecordForm((current) => (
      current.roomId === room._id ? current : buildDefaultRecordForm(room)
    ));
  }, [room]);

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
                  {room.recordedAt ? (
                    <Link href={`/games/records?gameSlug=${room.gameSlug}`}>기록 보기</Link>
                  ) : null}
                  {canSaveRoom ? (
                    <Link href={`/games/saves?gameSlug=${room.gameSlug}`}>저장 슬롯</Link>
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
                  <div><dt>기록</dt><dd>{room.recordedAt ? `${formatDate(room.recordedAt)} · ${Number(room.recordCount || 0)}건` : '아직 없음'}</dd></div>
                </dl>
              </section>
            </section>

            {canSaveRoom ? (
              <form className="games-panel game-room-record-panel" onSubmit={saveRoomSnapshot}>
                <div className="games-panel-title">
                  <h2>진행 저장</h2>
                  <span>리비전 {Number(room.revision || 0)}</span>
                </div>
                <div className="game-room-record-grid is-save">
                  <label>
                    <span>슬롯 키</span>
                    <input
                      value={saveForm.slotKey}
                      maxLength={80}
                      disabled={Boolean(busy)}
                      onChange={(event) => setSaveForm({ ...saveForm, slotKey: cleanSlotKey(event.target.value, '') })}
                    />
                  </label>
                  <label>
                    <span>저장 이름</span>
                    <input
                      value={saveForm.saveName}
                      maxLength={80}
                      disabled={Boolean(busy)}
                      onChange={(event) => setSaveForm({ ...saveForm, saveName: event.target.value })}
                    />
                  </label>
                </div>
                <label className="game-room-record-note">
                  <span>메모</span>
                  <textarea
                    rows={3}
                    value={saveForm.note}
                    disabled={Boolean(busy)}
                    onChange={(event) => setSaveForm({ ...saveForm, note: event.target.value })}
                  />
                </label>
                <div className="game-room-record-help">
                  현재 방의 상태 데이터, 설정, 요약, 리비전을 계정 저장 슬롯에 저장합니다.
                </div>
                <div className="account-actions">
                  <button type="submit" disabled={Boolean(busy)}>{busy === 'save-slot' ? '저장 중...' : '슬롯 저장'}</button>
                  <Link href={`/games/saves?gameSlug=${room.gameSlug}`}>저장 슬롯 보기</Link>
                </div>
              </form>
            ) : null}

            {canRecordResult ? (
              <form className="games-panel game-room-record-panel" onSubmit={recordRoomResult}>
                <div className="games-panel-title">
                  <h2>결과 확정</h2>
                  <span>전적 {roomPlayers.length}건 생성</span>
                </div>
                <div className="game-room-record-grid">
                  <label>
                    <span>기록 제목</span>
                    <input
                      value={recordForm.title}
                      maxLength={120}
                      disabled={Boolean(busy)}
                      onChange={(event) => setRecordForm({ ...recordForm, title: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>승자</span>
                    <select
                      value={recordForm.winnerUserId}
                      disabled={Boolean(busy)}
                      onChange={(event) => setRecordForm({ ...recordForm, winnerUserId: event.target.value })}
                    >
                      <option value="">승자 없음</option>
                      {roomPlayers.map((player) => (
                        <option value={userIdOf(player.userId)} key={`winner-${player.userId}`}>{playerDisplayName(player)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>공통 결과</span>
                    <select
                      value={recordForm.result}
                      disabled={Boolean(busy) || Boolean(recordForm.winnerUserId)}
                      onChange={(event) => setRecordForm({ ...recordForm, result: event.target.value })}
                    >
                      {RECORD_RESULT_OPTIONS.map(([value, label]) => (
                        <option value={value} key={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>점수</span>
                    <input
                      type="number"
                      value={recordForm.score}
                      disabled={Boolean(busy)}
                      onChange={(event) => setRecordForm({ ...recordForm, score: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>플레이 시간(초)</span>
                    <input
                      type="number"
                      min="0"
                      value={recordForm.playTimeSec}
                      disabled={Boolean(busy)}
                      onChange={(event) => setRecordForm({ ...recordForm, playTimeSec: event.target.value })}
                    />
                  </label>
                </div>
                <label className="game-room-record-note">
                  <span>메모</span>
                  <textarea
                    rows={3}
                    value={recordForm.note}
                    disabled={Boolean(busy)}
                    onChange={(event) => setRecordForm({ ...recordForm, note: event.target.value })}
                  />
                </label>
                <div className="game-room-record-help">
                  {recordForm.winnerUserId ? '선택한 승자는 승리, 나머지 참가자는 패배로 저장됩니다.' : '승자 없음이면 공통 결과가 모든 참가자 기록에 적용됩니다.'}
                </div>
                <div className="account-actions">
                  <button type="submit" disabled={Boolean(busy)}>{busy === 'record' ? '기록 중...' : '전적 생성'}</button>
                </div>
              </form>
            ) : null}

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
