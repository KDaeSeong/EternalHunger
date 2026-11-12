'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached, apiPost, AUTH_SYNC_EVENT, captureAuthSession, clearApiGetCache, isCurrentAuthSession } from '../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../utils/client-auth';
import GameActionIcon from '../games/_components/GameActionIcon';
import { useGameBgm } from '../games/_components/GameBgmProvider';
import { GameControlButton } from '../games/_components/GamePlayPrimitives';
import { useGameSfxEventHandlers } from '../games/_lib/useGameSfx';
import TwentyQuestionsFeedbackBar from './_components/TwentyQuestionsFeedbackBar';
import { twentyQuestionsFeedback } from './_lib/twentyQuestionsFeedback';
import {
  resolveTwentyQuestionsLobbyBgmScene,
  twentyQuestionsResultMusic,
} from './_lib/twentyQuestionsSoundtrack';

const CATEGORIES = [
  { value: 'free', label: '자유' },
  { value: 'game', label: '게임' },
  { value: 'character', label: '캐릭터' },
  { value: 'item', label: '아이템' },
  { value: 'country', label: '나라' },
  { value: 'place', label: '지명' },
  { value: 'person', label: '인물' },
  { value: 'food', label: '음식' },
  { value: 'organism', label: '생물' },
  { value: 'comic', label: '만화' },
  { value: 'movie', label: '영화' },
  { value: 'drama', label: '드라마' },
  { value: 'program', label: '프로그램' },
];

const STATUS_FILTERS = [
  { value: '', label: '전체' },
  { value: 'active', label: '진행 중' },
  { value: 'solved', label: '정답 공개' },
  { value: 'closed', label: '종료' },
];

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status) {
  if (status === 'solved') return '정답 공개';
  if (status === 'closed') return '종료';
  return '진행 중';
}

function roomStatusAction(status) {
  if (status === 'solved') return 'room-solved';
  if (status === 'closed') return 'room-closed';
  return 'room-active';
}

function normalizeRoom(row) {
  if (!row || typeof row !== 'object') return null;
  const questionCount = Number(row.questionCount || 0);
  const guessCount = Number(row.guessCount || 0);
  const maxQuestions = Number(row.maxQuestions || 20);
  const attemptCount = Number(row.attemptCount != null ? row.attemptCount : questionCount + guessCount);
  return {
    ...row,
    _id: safeText(row._id || row.id, ''),
    title: safeText(row.title, '제목 없음'),
    categoryLabel: safeText(row.categoryLabel, '자유'),
    hint: safeText(row.hint, ''),
    hostName: safeText(row.hostName || row.host?.nickname || row.host?.username, '익명'),
    status: safeText(row.status, 'active'),
    questionCount,
    maxQuestions,
    pendingCount: Number(row.pendingCount || 0),
    guessCount,
    attemptCount,
    remainingCount: Math.max(0, Number(row.remainingCount != null ? row.remainingCount : maxQuestions - attemptCount)),
  };
}

function unwrapRooms(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rooms)
      ? payload.rooms
      : [];
  return list.map(normalizeRoom).filter(Boolean);
}

function getDisplayName(user) {
  return safeText(user?.nickname || user?.username, '사용자');
}

export default function TwentyQuestionsPage() {
  const router = useRouter();
  const mounted = useHydrated();
  const token = useAuthToken();
  const user = useAuthUser();
  const { showToast } = useToast();
  const { setMusicScene } = useGameBgm();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [creating, setCreating] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ title: '', category: 'free', hint: '', answer: '' });
  const [actionFeedback, setActionFeedback] = useState(null);
  const musicBaseSceneRef = useRef('');
  const musicSceneTimerRef = useRef(null);
  const {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
    playGameSfx,
  } = useGameSfxEventHandlers({ theme: 'twenty' });
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const ownerKey = token ? safeText(user?._id || user?.id || user?.username, 'signed-in') : 'guest';
  const ownerContextKey = JSON.stringify([ownerKey, token, sessionEpoch]);
  const filterKey = JSON.stringify([statusFilter, categoryFilter]);
  const lobbyRef = useRef({ active: false, contextKey: '', ownerKey: '', generation: 0, session: null,
    filterKey: '', listGeneration: 0, listRequest: null, createRequest: null,
    formRevision: 0, writerRevision: 0, musicRevision: 0 });
  const formRef = useRef(form);
  const writerRef = useRef(writerOpen);
  const filtersRef = useRef({ status: statusFilter, category: categoryFilter });
  const loadRoomsRef = useRef(null);
  const initialLocationReadRef = useRef(false);
  const formRevision = lobbyRef.current.formRevision;
  const writerRevision = lobbyRef.current.writerRevision;

  const cancelResultMusic = useCallback(() => {
    lobbyRef.current.musicRevision += 1;
    if (musicSceneTimerRef.current) {
      window.clearTimeout(musicSceneTimerRef.current);
      musicSceneTimerRef.current = null;
      setMusicScene(musicBaseSceneRef.current);
    }
  }, [setMusicScene]);

  const retireLobbySession = useCallback(() => {
    const scope = lobbyRef.current;
    if (!scope.active) return;
    scope.active = false;
    scope.generation += 1;
    scope.listGeneration += 1;
    scope.listRequest = null;
    scope.createRequest = null;
    cancelResultMusic();
    setSessionEpoch(value => value + 1);
  }, [cancelResultMusic]);

  const isLobbyContextCurrent = useCallback(() => {
    const scope = lobbyRef.current;
    if (!scope.active || scope.contextKey !== ownerContextKey) return false;
    if (!isCurrentAuthSession(scope.session)) {
      retireLobbySession();
      return false;
    }
    return true;
  }, [ownerContextKey, retireLobbySession]);

  const isCurrentListRequest = useCallback(request => {
    const scope = lobbyRef.current;
    return Boolean(request) && isLobbyContextCurrent() && scope.listRequest === request
      && scope.generation === request.generation && scope.listGeneration === request.listGeneration
      && scope.filterKey === request.filterKey && isCurrentAuthSession(request.session);
  }, [isLobbyContextCurrent]);

  const isCurrentCreateRequest = useCallback(request => {
    const scope = lobbyRef.current;
    return Boolean(request) && isLobbyContextCurrent() && scope.createRequest === request
      && scope.generation === request.generation && scope.formRevision === request.formRevision
      && scope.writerRevision === request.writerRevision && isCurrentAuthSession(request.session);
  }, [isLobbyContextCurrent]);

  const retireCreateIntent = useCallback(() => {
    const scope = lobbyRef.current;
    scope.createRequest = null;
    setCreating(false);
    cancelResultMusic();
  }, [cancelResultMusic]);
  const updateForm = useCallback(value => {
    if (!isLobbyContextCurrent()) return;
    const next = typeof value === 'function' ? value(formRef.current) : value;
    lobbyRef.current.formRevision += 1;
    retireCreateIntent();
    formRef.current = next;
    setForm(next);
  }, [isLobbyContextCurrent, retireCreateIntent]);
  const updateWriterOpen = useCallback(value => {
    if (!isLobbyContextCurrent()) return;
    const next = typeof value === 'function' ? value(writerRef.current) : value;
    if (next === writerRef.current) return;
    lobbyRef.current.writerRevision += 1;
    retireCreateIntent();
    writerRef.current = next;
    setWriterOpen(next);
  }, [isLobbyContextCurrent, retireCreateIntent]);
  const updateFilter = useCallback((kind, value) => {
    if (!isLobbyContextCurrent()) return;
    const next = typeof value === 'function' ? value(filtersRef.current[kind]) : value;
    if (next === filtersRef.current[kind]) return;
    filtersRef.current = { ...filtersRef.current, [kind]: next };
    const scope = lobbyRef.current;
    scope.filterKey = JSON.stringify([filtersRef.current.status, filtersRef.current.category]);
    scope.listGeneration += 1;
    scope.listRequest = null;
    if (scope.createRequest?.recovering) retireCreateIntent();
    else cancelResultMusic();
    if (kind === 'status') setStatusFilter(next);
    else setCategoryFilter(next);
  }, [cancelResultMusic, isLobbyContextCurrent, retireCreateIntent]);
  const updateStatusFilter = useCallback(value => updateFilter('status', value), [updateFilter]);
  const updateCategoryFilter = useCallback(value => updateFilter('category', value), [updateFilter]);
  const writerVisible = writerOpen && lobbyRef.current.active
    && lobbyRef.current.contextKey === ownerContextKey && isCurrentAuthSession(lobbyRef.current.session);

  useLayoutEffect(() => {
    const scope = lobbyRef.current;
    const ownerChanged = scope.ownerKey !== ownerKey;
    scope.contextKey = ownerContextKey;
    scope.ownerKey = ownerKey;
    scope.generation += 1;
    scope.listGeneration += 1;
    scope.session = captureAuthSession();
    scope.active = true;
    scope.listRequest = null;
    scope.createRequest = null;
    scope.formRevision += 1;
    scope.writerRevision += 1;
    setCreating(false);
    setLoadError('');
    setActionFeedback(null);
    setRooms([]);
    cancelResultMusic();
    if (ownerChanged) {
      const empty = { title: '', category: 'free', hint: '', answer: '' };
      formRef.current = empty;
      writerRef.current = false;
      setForm(empty);
      setWriterOpen(false);
    }
    return () => {
      scope.active = false;
      scope.generation += 1;
      scope.listGeneration += 1;
      scope.listRequest = null;
      scope.createRequest = null;
      scope.musicRevision += 1;
    };
  }, [cancelResultMusic, ownerContextKey, ownerKey]);

  useLayoutEffect(() => {
    const scope = lobbyRef.current;
    scope.filterKey = filterKey;
    scope.listGeneration += 1;
    scope.listRequest = null;
    filtersRef.current = { status: statusFilter, category: categoryFilter };
    return () => {
      scope.listGeneration += 1;
      scope.listRequest = null;
    };
  }, [categoryFilter, filterKey, ownerContextKey, statusFilter]);

  useEffect(() => {
    const handleAuthChange = event => {
      if (event?.type === 'storage' && event.key && !['user', 'eh_auth_sync_ts'].includes(event.key)) return;
      const scope = lobbyRef.current;
      if (scope.session && !isCurrentAuthSession(scope.session)) retireLobbySession();
    };
    window.addEventListener(AUTH_SYNC_EVENT, handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [retireLobbySession]);

  const baseMusicScene = useMemo(() => resolveTwentyQuestionsLobbyBgmScene({
    writerOpen: writerVisible,
    loadError,
  }), [loadError, writerVisible]);

  useEffect(() => {
    musicBaseSceneRef.current = baseMusicScene;
    if (musicSceneTimerRef.current) return;
    setMusicScene(baseMusicScene);
  }, [baseMusicScene, setMusicScene]);

  useEffect(() => () => {
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    setMusicScene('');
  }, [setMusicScene]);

  const announce = (action, result = {}) => {
    if (!isLobbyContextCurrent()) return null;
    const feedback = twentyQuestionsFeedback(action, result);
    setActionFeedback(feedback);
    playGameSfx(feedback.cue);
    const transition = twentyQuestionsResultMusic(feedback);
    if (transition) {
      const generation = lobbyRef.current.generation;
      const musicRevision = ++lobbyRef.current.musicRevision;
      const session = captureAuthSession();
      if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
      setMusicScene(transition.theme);
      musicSceneTimerRef.current = window.setTimeout(() => {
        if (!isLobbyContextCurrent() || lobbyRef.current.generation !== generation
          || lobbyRef.current.musicRevision !== musicRevision || !isCurrentAuthSession(session)) return;
        setMusicScene(musicBaseSceneRef.current);
        musicSceneTimerRef.current = null;
      }, transition.durationMs);
    }
    return feedback;
  };

  const loadRooms = useCallback(async ({ force = false } = {}) => {
    const scope = lobbyRef.current;
    if (!isLobbyContextCurrent() || scope.filterKey !== filterKey) return null;
    const request = { generation: scope.generation, listGeneration: scope.listGeneration,
      filterKey, session: captureAuthSession() };
    scope.listRequest = request;
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await apiGetCached(`/twenty-questions${suffix}`, {
        ttlMs: 5000, timeoutMs: 15000, storage: 'session', force,
      });
      if (!isCurrentListRequest(request)) return null;
      setRooms(unwrapRooms(data));
      return true;
    } catch (err) {
      if (!isCurrentListRequest(request)) return null;
      const message = err?.message || '스무고개 방을 불러오지 못했습니다.';
      setLoadError(message);
      showToast({ tone: 'danger', message });
      return false;
    } finally {
      if (isCurrentListRequest(request)) setLoading(false);
    }
  }, [categoryFilter, filterKey, isCurrentListRequest, isLobbyContextCurrent, showToast, statusFilter]);

  useLayoutEffect(() => { loadRoomsRef.current = loadRooms; }, [loadRooms]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (!mounted || token) return;
    updateWriterOpen(false);
  }, [mounted, token, updateWriterOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || initialLocationReadRef.current || !isLobbyContextCurrent()) return;
    initialLocationReadRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const nextStatus = safeText(params.get('status'), '');
    const nextCategory = safeText(params.get('category'), '');
    if (STATUS_FILTERS.some((item) => item.value === nextStatus)) updateStatusFilter(nextStatus);
    if (CATEGORIES.some((item) => item.value === nextCategory)) updateCategoryFilter(nextCategory);
    if (params.get('create') === '1') updateWriterOpen(true);
  }, [isLobbyContextCurrent, updateCategoryFilter, updateStatusFilter, updateWriterOpen]);

  const filteredRooms = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rooms;
    return rooms.filter((room) => [
      room.title,
      room.categoryLabel,
      room.hint,
      room.hostName,
      statusLabel(room.status),
    ].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [query, rooms]);

  const activeCount = useMemo(() => rooms.filter((room) => room.status === 'active').length, [rooms]);

  const refreshRooms = async () => {
    const pending = loadRooms({ force: true });
    const request = lobbyRef.current.listRequest;
    const ok = await pending;
    if (ok === null || !isCurrentListRequest(request)) return;
    announce(ok ? 'refresh' : 'roomLoadFailure', {
      ok,
      message: ok ? '최신 스무고개 방 목록을 불러왔습니다.' : '스무고개 방 목록을 불러오지 못했습니다.',
    });
  };

  const createRoom = async () => {
    const scope = lobbyRef.current;
    if (!mounted || !token || !isLobbyContextCurrent() || scope.createRequest
      || scope.formRevision !== formRevision || scope.writerRevision !== writerRevision
      || formRef.current !== form) return;
    const payload = {
      title: form.title.trim(), category: form.category, hint: form.hint.trim(), answer: form.answer.trim(),
    };
    if (!payload.title || !payload.answer) {
      const message = '방 제목과 정답을 입력해주세요.';
      announce('invalid', { ok: false, message });
      showToast({ tone: 'warning', message });
      return;
    }

    const request = { generation: scope.generation, formRevision, writerRevision,
      session: captureAuthSession(), recovering: false };
    scope.createRequest = request;
    setCreating(true);
    try {
      const data = await apiPost('/twenty-questions', payload, { timeoutMs: 15000 });
      if (!isCurrentCreateRequest(request)) return;
      const roomId = data?.room?._id || data?.room?.id;
      const message = data?.message || '스무고개 방을 만들었습니다.';
      announce('roomCreate', { message });
      showToast({ tone: 'success', message });
      clearApiGetCache('/twenty-questions');
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/search');
      const empty = { title: '', category: 'free', hint: '', answer: '' };
      formRef.current = empty;
      writerRef.current = false;
      setForm(empty);
      setWriterOpen(false);
      if (roomId) router.push(`/twenty-questions/${roomId}`);
      else {
        request.recovering = true;
        await loadRoomsRef.current?.({ force: true });
      }
    } catch (err) {
      if (!isCurrentCreateRequest(request)) return;
      clearApiGetCache('/twenty-questions');
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/search');
      request.recovering = true;
      const reloaded = await loadRoomsRef.current?.({ force: true });
      if (reloaded === null || !isCurrentCreateRequest(request)) return;
      const message = err?.message || '스무고개 방 생성에 실패했습니다.';
      announce('roomCreateFailure', { ok: false, message });
      showToast({ tone: 'danger', message });
    } finally {
      if (isCurrentCreateRequest(request)) {
        lobbyRef.current.createRequest = null;
        setCreating(false);
      }
    }
  };

  return (
    <main
      className="twenty-page twenty-page--viewport twenty-page--lobby"
      onChangeCapture={handleGameSfxChangeCapture}
      onPointerDownCapture={handleGameSfxPointerDownCapture}
    >
      <SiteHeader />
      <section className="twenty-shell">
        <div className="twenty-head">
          <div>
            <p className="twenty-eyebrow">Community Game</p>
            <h1>스무고개</h1>
          </div>
          <div className="twenty-head-actions">
            {mounted && token ? (
              <GameControlButton
                action={writerVisible ? 'close' : 'room'}
                cue={writerVisible ? 'twentyWriterClose' : 'twentyWriterOpen'}
                className="twenty-button"
                onClick={() => updateWriterOpen((value) => !value)}
                aria-expanded={writerVisible}
                aria-controls="twenty-create-panel"
              >
                {writerVisible ? '닫기' : '방 만들기'}
              </GameControlButton>
            ) : (
              <Link href="/login" className="twenty-button game-control-button" data-game-sfx="nav">
                <GameActionIcon action="settings" label="로그인" />
                <span className="game-action-button__label">로그인</span>
              </Link>
            )}
            <Link href="/board" className="twenty-button twenty-button-secondary game-control-button" data-game-sfx="nav">
              <GameActionIcon action="archive" label="게시판" />
              <span className="game-action-button__label">게시판</span>
            </Link>
          </div>
        </div>

        <TwentyQuestionsFeedbackBar feedback={actionFeedback} />

        <section className="twenty-toolbar" aria-label="스무고개 필터">
          <div className="twenty-stats">
            <span><GameActionIcon action="room" label="전체 방" />전체 {rooms.length}</span>
            <span><GameActionIcon action="room-active" label="진행 중" />진행 {activeCount}</span>
            <span><GameActionIcon action="search" label="검색 결과" />검색 {filteredRooms.length}</span>
          </div>
          <div className="twenty-filters">
            <select data-game-sfx-change="twentyFilter" value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)} aria-label="상태">
              {STATUS_FILTERS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
            <select data-game-sfx-change="twentyFilter" value={categoryFilter} onChange={(event) => updateCategoryFilter(event.target.value)} aria-label="카테고리">
              <option value="">모든 주제</option>
              {CATEGORIES.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="방 검색"
              aria-label="방 검색"
            />
          </div>
        </section>

        {mounted && token && writerVisible ? (
          <section className="twenty-create-panel" id="twenty-create-panel">
            <div className="twenty-create-title">
              <strong><GameActionIcon action="room" label="새 방" />새 방</strong>
              <span><GameActionIcon action="host" label="방장" />방장 {getDisplayName(user)}</span>
            </div>
            <div className="twenty-create-grid">
              <input
                value={form.title}
                onChange={(event) => updateForm({ ...form, title: event.target.value })}
                placeholder="방 제목"
                maxLength={80}
              />
              <select value={form.category} onChange={(event) => updateForm({ ...form, category: event.target.value })}>
                {CATEGORIES.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                value={form.answer}
                onChange={(event) => updateForm({ ...form, answer: event.target.value })}
                placeholder="정답"
                maxLength={120}
              />
              <GameControlButton action="room" cue="off" onClick={createRoom} disabled={creating}>
                {creating ? '생성 중...' : '생성'}
              </GameControlButton>
            </div>
            <textarea
              value={form.hint}
              onChange={(event) => updateForm({ ...form, hint: event.target.value })}
              placeholder="첫 힌트"
              rows={3}
              maxLength={180}
            />
          </section>
        ) : null}

        {!mounted || token ? null : (
          <div className="twenty-note twenty-inline-state">
            <GameActionIcon action="lock" label="로그인 필요" />
            <span>로그인하면 스무고개 방을 만들고 질문/정답 도전에 참여할 수 있습니다.</span>
          </div>
        )}

        <section className="twenty-room-grid" aria-label="스무고개 방 목록">
          {loading ? (
            <div className="twenty-empty twenty-inline-state">
              <GameActionIcon action="wait" label="방 불러오는 중" />
              <span>방을 불러오는 중입니다.</span>
            </div>
          ) : null}
          {!loading && loadError ? (
            <div className="twenty-empty twenty-error">
              <GameActionIcon action="warning" label="방 목록 오류" />
              <span>{loadError}</span>
              <GameControlButton action="refresh" onClick={() => void refreshRooms()}>다시 불러오기</GameControlButton>
            </div>
          ) : null}
          {!loading && !loadError && filteredRooms.length === 0 ? (
            <div className="twenty-empty twenty-inline-state">
              <GameActionIcon action="search" label="검색 결과 없음" />
              <span>표시할 방이 없습니다.</span>
            </div>
          ) : null}
          {!loading && filteredRooms.map((room) => (
            <Link href={`/twenty-questions/${room._id}`} className="twenty-room-card" data-game-sfx="twentyRoomEnter" key={room._id}>
              <div className="twenty-card-top">
                <GameActionIcon action="room" label="방 입장" className="twenty-room-card-icon" />
                <span className={`twenty-status is-${room.status}`}>
                  <GameActionIcon action={roomStatusAction(room.status)} label={statusLabel(room.status)} />
                  {statusLabel(room.status)}
                </span>
                <span><GameActionIcon action="category" label="주제" />{room.categoryLabel}</span>
              </div>
              <h2>{room.title}</h2>
              <p className="twenty-card-hint"><GameActionIcon action="hint-message" label="힌트" /><span>{room.hint || '힌트 없음'}</span></p>
              <div className="twenty-card-meta">
                <span><GameActionIcon action="host" label="방장" />{room.hostName}</span>
                <span><GameActionIcon action="attempt-limit" label="사용 횟수" />{room.attemptCount}/{room.maxQuestions}</span>
                <span><GameActionIcon action="question" label="질문" />{room.questionCount}</span>
                <span><GameActionIcon action="guess" label="정답 도전" />{room.guessCount}</span>
                {room.pendingCount > 0 ? <span><GameActionIcon action="answer-pending" label="답변 대기" />{room.pendingCount}</span> : null}
              </div>
              <small className="twenty-card-date"><GameActionIcon action="clock" label="최근 갱신" />{formatDate(room.updatedAt || room.createdAt)}</small>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
