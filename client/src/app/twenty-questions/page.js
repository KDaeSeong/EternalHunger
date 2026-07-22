'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached, apiPost, clearApiGetCache } from '../../utils/api';
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
  const baseMusicScene = useMemo(() => resolveTwentyQuestionsLobbyBgmScene({
    writerOpen,
    loadError,
  }), [loadError, writerOpen]);

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
    const feedback = twentyQuestionsFeedback(action, result);
    setActionFeedback(feedback);
    playGameSfx(feedback.cue);
    const transition = twentyQuestionsResultMusic(feedback);
    if (transition) {
      if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
      setMusicScene(transition.theme);
      musicSceneTimerRef.current = window.setTimeout(() => {
        setMusicScene(musicBaseSceneRef.current);
        musicSceneTimerRef.current = null;
      }, transition.durationMs);
    }
    return feedback;
  };

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await apiGetCached(`/twenty-questions${suffix}`, {
        ttlMs: 5000,
        timeoutMs: 15000,
        storage: 'session',
      });
      setRooms(unwrapRooms(data));
      return true;
    } catch (err) {
      const message = err?.message || '스무고개 방을 불러오지 못했습니다.';
      setLoadError(message);
      showToast({ tone: 'danger', message });
      return false;
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, showToast, statusFilter]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (!mounted || token) return;
    setWriterOpen(false);
  }, [mounted, token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const nextStatus = safeText(params.get('status'), '');
    const nextCategory = safeText(params.get('category'), '');
    if (STATUS_FILTERS.some((item) => item.value === nextStatus)) setStatusFilter(nextStatus);
    if (CATEGORIES.some((item) => item.value === nextCategory)) setCategoryFilter(nextCategory);
    if (params.get('create') === '1') setWriterOpen(true);
  }, []);

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
    const ok = await loadRooms();
    announce(ok ? 'refresh' : 'invalid', {
      ok,
      message: ok ? '최신 스무고개 방 목록을 불러왔습니다.' : '스무고개 방 목록을 불러오지 못했습니다.',
    });
  };

  const createRoom = async () => {
    const payload = {
      title: form.title.trim(),
      category: form.category,
      hint: form.hint.trim(),
      answer: form.answer.trim(),
    };
    if (!payload.title || !payload.answer) {
      const message = '방 제목과 정답을 입력해주세요.';
      announce('invalid', { ok: false, message });
      showToast({ tone: 'warning', message });
      return;
    }

    setCreating(true);
    try {
      const data = await apiPost('/twenty-questions', payload, { timeoutMs: 15000 });
      const roomId = data?.room?._id || data?.room?.id;
      const message = data?.message || '스무고개 방을 만들었습니다.';
      announce('roomCreate', { message });
      showToast({ tone: 'success', message });
      clearApiGetCache('/twenty-questions');
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/search');
      setForm({ title: '', category: 'free', hint: '', answer: '' });
      setWriterOpen(false);
      if (roomId) router.push(`/twenty-questions/${roomId}`);
      else await loadRooms();
    } catch (err) {
      clearApiGetCache('/twenty-questions');
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/search');
      await loadRooms();
      const message = err?.message || '스무고개 방 생성에 실패했습니다.';
      announce('invalid', { ok: false, message });
      showToast({ tone: 'danger', message });
    } finally {
      setCreating(false);
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
                action={writerOpen ? 'close' : 'room'}
                className="twenty-button"
                onClick={() => setWriterOpen((value) => !value)}
                aria-expanded={writerOpen}
                aria-controls="twenty-create-panel"
              >
                {writerOpen ? '닫기' : '방 만들기'}
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
            <span>전체 {rooms.length}</span>
            <span>진행 {activeCount}</span>
            <span>검색 {filteredRooms.length}</span>
          </div>
          <div className="twenty-filters">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="상태">
              {STATUS_FILTERS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="카테고리">
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

        {mounted && token && writerOpen ? (
          <section className="twenty-create-panel" id="twenty-create-panel">
            <div className="twenty-create-title">
              <strong>새 방</strong>
              <span>방장 {getDisplayName(user)}</span>
            </div>
            <div className="twenty-create-grid">
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="방 제목"
                maxLength={80}
              />
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {CATEGORIES.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                value={form.answer}
                onChange={(event) => setForm({ ...form, answer: event.target.value })}
                placeholder="정답"
                maxLength={120}
              />
              <GameControlButton action="room" onClick={createRoom} disabled={creating}>
                {creating ? '생성 중...' : '생성'}
              </GameControlButton>
            </div>
            <textarea
              value={form.hint}
              onChange={(event) => setForm({ ...form, hint: event.target.value })}
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
          {loading ? <div className="twenty-empty">방을 불러오는 중입니다.</div> : null}
          {!loading && loadError ? (
            <div className="twenty-empty twenty-error">
              <span>{loadError}</span>
              <GameControlButton action="refresh" onClick={() => void refreshRooms()}>다시 불러오기</GameControlButton>
            </div>
          ) : null}
          {!loading && !loadError && filteredRooms.length === 0 ? <div className="twenty-empty">표시할 방이 없습니다.</div> : null}
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
