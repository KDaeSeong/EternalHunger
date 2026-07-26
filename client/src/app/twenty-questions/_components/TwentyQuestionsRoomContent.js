'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiGet, apiPost, clearApiGetCache } from '../../../utils/api';
import { useAuthToken, useHydrated } from '../../../utils/client-auth';
import GameActionIcon from '../../games/_components/GameActionIcon';
import { useGameBgm } from '../../games/_components/GameBgmProvider';
import { GameFeatureTabs } from '../../games/_components/GamePlayShell';
import { GameControlButton } from '../../games/_components/GamePlayPrimitives';
import { useGameSfxEventHandlers } from '../../games/_lib/useGameSfx';
import { twentyQuestionsFeedback } from '../_lib/twentyQuestionsFeedback';
import {
  twentyQuestionsProgressTransition,
  twentyQuestionsRoomProgress,
} from '../_lib/twentyQuestionsProgress';
import {
  resolveTwentyQuestionsRoomBgmScene,
  twentyQuestionsResultMusic,
} from '../_lib/twentyQuestionsSoundtrack';
import TwentyQuestionsAttemptMeter from './TwentyQuestionsAttemptMeter';
import TwentyQuestionsFeedbackBar from './TwentyQuestionsFeedbackBar';

const RESPONSE_OPTIONS = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니오' },
  { value: 'maybe', label: '애매함' },
];

const ROOM_POLL_INTERVAL_MS = 3500;
const PRESENCE_HEARTBEAT_INTERVAL_MS = 8000;

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeIdValue(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value?.$oid) return String(value.$oid);
  if (value?._id && value._id !== value) return normalizeIdValue(value._id);
  if (value?.id && value.id !== value) return normalizeIdValue(value.id);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
}

function userProfileHref(value) {
  const id = normalizeIdValue(value);
  return id ? `/users/${id}` : '';
}

function normalizeRouteId(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw == null ? '' : String(raw);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR');
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

function responseAction(response) {
  if (response === 'yes') return 'answer-yes';
  if (response === 'no') return 'answer-no';
  if (response === 'maybe') return 'answer-maybe';
  return 'answer-pending';
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRoom(payload) {
  const row = payload?.room || payload?.data || payload;
  if (!row || typeof row !== 'object') return null;
  const questions = normalizeList(row.questions);
  const guesses = normalizeList(row.guesses);
  const hintMessages = normalizeList(row.hintMessages);
  const participants = normalizeList(row.participants)
    .map((participant) => ({
      ...participant,
      _id: normalizeIdValue(participant?._id || participant?.user),
      name: safeText(participant?.name || participant?.user?.nickname || participant?.user?.username, '익명'),
    }))
    .filter((participant) => participant._id);
  const questionCount = Number(row.questionCount || questions.length);
  const guessCount = Number(row.guessCount || guesses.length);
  const maxQuestions = Number(row.maxQuestions || 20);
  const attemptCount = Number(row.attemptCount != null ? row.attemptCount : questionCount + guessCount);
  return {
    ...row,
    _id: safeText(row._id || row.id, ''),
    title: safeText(row.title, '제목 없음'),
    categoryLabel: safeText(row.categoryLabel, '자유'),
    hint: safeText(row.hint, ''),
    hostId: row.hostId || row.host?._id || row.host?.id || '',
    hostName: safeText(row.hostName || row.host?.nickname || row.host?.username, '익명'),
    solvedByName: safeText(row.solvedByName || row.solvedBy?.nickname || row.solvedBy?.username, ''),
    status: safeText(row.status, 'active'),
    maxQuestions,
    questionCount,
    pendingCount: Number(row.pendingCount || 0),
    guessCount,
    attemptCount,
    remainingCount: Math.max(0, Number(row.remainingCount != null ? row.remainingCount : maxQuestions - attemptCount)),
    answer: safeText(row.answer, ''),
    answerRevealed: Boolean(row.answerRevealed),
    viewerId: normalizeIdValue(row.viewerId),
    isHost: Boolean(row.isHost),
    participantCount: Number(row.participantCount != null ? row.participantCount : participants.length),
    participants,
    questions,
    guesses,
    hintMessages,
  };
}

function roomVersion(room) {
  if (!room) return '';
  return JSON.stringify({
    status: room.status || '',
    answerRevealed: Boolean(room.answerRevealed),
    questions: normalizeList(room.questions).map((question) => [
      normalizeIdValue(question),
      question?.response || 'pending',
      question?.updatedAt || '',
    ]),
    guesses: normalizeList(room.guesses).map((guess) => [
      normalizeIdValue(guess),
      Boolean(guess?.correct),
      guess?.createdAt || '',
    ]),
    hints: normalizeList(room.hintMessages).map((message) => [
      normalizeIdValue(message),
      message?.updatedAt || message?.createdAt || '',
    ]),
    participants: normalizeList(room.participants)
      .map((participant) => normalizeIdValue(participant))
      .filter(Boolean)
      .sort(),
  });
}

function dateValue(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function progressFeedbackMessage(action, message = '') {
  const suffix = {
    phaseNarrow: '절반의 시도를 사용해 후보 범위를 압축할 단계입니다.',
    phaseFinal: '남은 시도는 5회 이하입니다. 가장 가능성 높은 답을 검증하세요.',
    phasePending: '마지막 질문의 답변을 기다립니다.',
  }[action] || '';
  return [String(message || '').trim(), suffix].filter(Boolean).join(' ');
}

export default function TwentyQuestionsRoomContent() {
  const params = useParams();
  const router = useRouter();
  const id = normalizeRouteId(params?.id);
  const hydrated = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();
  const { setMusicScene } = useGameBgm();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [guessText, setGuessText] = useState('');
  const [hintText, setHintText] = useState('');
  const [submitting, setSubmitting] = useState('');
  const [actionFeedback, setActionFeedback] = useState(null);
  const [activePanel, setActivePanel] = useState('deduction');
  const roomRef = useRef(null);
  const submittingRef = useRef('');
  const musicBaseSceneRef = useRef('');
  const musicSceneTimerRef = useRef(null);
  const loadErrorAnnouncedRef = useRef('');
  const {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
    playGameSfx,
  } = useGameSfxEventHandlers({ theme: 'twenty' });

  const loadRoom = useCallback(async () => {
    if (!id) {
      const message = '방 주소가 올바르지 않습니다.';
      roomRef.current = null;
      setRoom(null);
      setLoadError(message);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiGet(`/twenty-questions/${id}`, { timeoutMs: 15000 });
      const nextRoom = normalizeRoom(data);
      if (!nextRoom) throw new Error('스무고개 방 정보를 확인할 수 없습니다.');
      roomRef.current = nextRoom;
      setRoom(nextRoom);
    } catch (err) {
      const message = err?.message || '스무고개 방을 불러오지 못했습니다.';
      roomRef.current = null;
      setRoom(null);
      setLoadError(message);
      showToast({ tone: 'danger', message });
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void Promise.resolve().then(loadRoom);
  }, [loadRoom]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  const pendingQuestions = useMemo(
    () => normalizeList(room?.questions).filter((question) => question?.response === 'pending'),
    [room?.questions]
  );
  const hintMessages = useMemo(
    () => normalizeList(room?.hintMessages),
    [room?.hintMessages]
  );
  const attemptTimeline = useMemo(() => {
    const questions = normalizeList(room?.questions).map((question, index) => ({
      id: normalizeIdValue(question) || `question-${index}`,
      kind: 'question',
      text: question?.text || '',
      actorName: question?.askerName || '익명',
      response: question?.response || 'pending',
      responseLabel: question?.responseLabel || '대기',
      createdAt: question?.createdAt || '',
      sortOrder: index,
    }));
    const guesses = normalizeList(room?.guesses).map((guess, index) => ({
      id: normalizeIdValue(guess) || `guess-${index}`,
      kind: 'guess',
      text: guess?.text || '',
      actorName: guess?.guesserName || '익명',
      correct: Boolean(guess?.correct),
      createdAt: guess?.createdAt || '',
      sortOrder: index,
    }));

    return [...questions, ...guesses]
      .sort((left, right) => dateValue(left.createdAt) - dateValue(right.createdAt)
        || left.kind.localeCompare(right.kind)
        || left.sortOrder - right.sortOrder)
      .map((entry, index) => ({ ...entry, attemptNo: index + 1 }));
  }, [room?.guesses, room?.questions]);
  const active = room?.status === 'active';
  const attemptsLeft = Math.max(0, Number(room?.remainingCount != null ? room.remainingCount : Number(room?.maxQuestions || 20) - Number(room?.attemptCount || 0)));
  const canInteract = hydrated && token && active && !room?.isHost;
  const canUseAttempt = canInteract && attemptsLeft > 0;
  const roomProgress = useMemo(() => twentyQuestionsRoomProgress(room || {}), [room]);
  const baseMusicScene = useMemo(() => resolveTwentyQuestionsRoomBgmScene({
    status: room?.status,
    answerRevealed: room?.answerRevealed,
    attemptsLeft,
    pendingCount: pendingQuestions.length,
    isHost: room?.isHost,
    submitting,
    loadError,
  }), [attemptsLeft, loadError, pendingQuestions.length, room?.answerRevealed, room?.isHost, room?.status, submitting]);

  useEffect(() => {
    musicBaseSceneRef.current = baseMusicScene;
    if (musicSceneTimerRef.current) return;
    setMusicScene(baseMusicScene);
  }, [baseMusicScene, setMusicScene]);

  useEffect(() => () => {
    if (musicSceneTimerRef.current) window.clearTimeout(musicSceneTimerRef.current);
    setMusicScene('');
  }, [setMusicScene]);

  const announce = useCallback((action, result = {}) => {
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
  }, [playGameSfx, setMusicScene]);

  useEffect(() => {
    if (!loadError) {
      loadErrorAnnouncedRef.current = '';
      return;
    }
    if (loadErrorAnnouncedRef.current === loadError) return;
    loadErrorAnnouncedRef.current = loadError;
    announce('roomLoadFailure', { ok: false, message: loadError });
  }, [announce, loadError]);

  const announceRemoteRoomChange = useCallback((previousRoom, nextRoom) => {
    if (!previousRoom || !nextRoom) return;

    if (previousRoom.status === 'active' && nextRoom.status === 'solved') {
      const guesses = normalizeList(nextRoom.guesses);
      const winningGuess = [...guesses].reverse().find((guess) => Boolean(guess?.correct));
      const solverName = nextRoom.solvedByName || winningGuess?.guesserName || '참가자';
      announce('remoteSolved', { message: `${solverName}님이 정답을 맞혔습니다. 정답을 공개합니다.` });
      return;
    }
    if (previousRoom.status === 'active' && nextRoom.status === 'closed') {
      const exhausted = Number(nextRoom.attemptCount || 0) >= Number(nextRoom.maxQuestions || 20);
      announce(exhausted ? 'limitReveal' : 'close', {
        message: exhausted
          ? '20회를 모두 사용했습니다. 정답을 공개합니다.'
          : '방장이 스무고개를 종료했습니다.',
      });
      return;
    }

    const previousQuestionMap = new Map(normalizeList(previousRoom.questions).map((question) => [
      normalizeIdValue(question),
      question,
    ]));
    const answeredQuestion = normalizeList(nextRoom.questions).find((question) => {
      const previous = previousQuestionMap.get(normalizeIdValue(question));
      return previous?.response === 'pending' && question?.response && question.response !== 'pending';
    });
    if (answeredQuestion) {
      announce('answer', {
        response: answeredQuestion.response,
        message: `방장이 ${answeredQuestion.responseLabel || '답변'}로 답했습니다.`,
      });
      return;
    }
    if (normalizeList(nextRoom.hintMessages).length > normalizeList(previousRoom.hintMessages).length) {
      announce('remoteHint', { message: '방장이 새 힌트를 공개했습니다.' });
      return;
    }
    const previousQuestionCount = normalizeList(previousRoom.questions).length;
    const nextQuestionCount = normalizeList(nextRoom.questions).length;
    const previousGuessCount = normalizeList(previousRoom.guesses).length;
    const nextGuesses = normalizeList(nextRoom.guesses);
    const latestGuess = nextGuesses[nextGuesses.length - 1];
    const guesserName = latestGuess?.guesserName || '참가자';
    const milestone = twentyQuestionsProgressTransition(previousRoom, nextRoom);
    if (milestone) {
      const baseMessage = nextQuestionCount > previousQuestionCount
        ? '새 질문이 등록되었습니다.'
        : nextGuesses.length > previousGuessCount
          ? `${guesserName}님의 정답 도전은 오답입니다.`
          : '추리 단계가 변경되었습니다.';
      announce(milestone, { message: progressFeedbackMessage(milestone, baseMessage) });
      return;
    }
    if (nextQuestionCount > previousQuestionCount) {
      announce('remoteQuestion', { message: '새 질문이 등록되었습니다.' });
      return;
    }
    if (nextGuesses.length > previousGuessCount) {
      announce('remoteWrong', { message: `${guesserName}님의 정답 도전은 오답입니다.` });
      return;
    }

    const previousParticipants = new Map(normalizeList(previousRoom.participants).map((participant) => [
      normalizeIdValue(participant),
      participant,
    ]));
    const nextParticipants = new Map(normalizeList(nextRoom.participants).map((participant) => [
      normalizeIdValue(participant),
      participant,
    ]));
    const joined = [...nextParticipants.entries()].filter(([participantId]) => (
      participantId && participantId !== nextRoom.viewerId && !previousParticipants.has(participantId)
    ));
    if (joined.length > 0) {
      const name = joined[0][1]?.name || '새 참가자';
      const suffix = joined.length > 1 ? ` 외 ${joined.length - 1}명` : '';
      announce('participantJoin', { message: `${name}님${suffix}이 방에 들어왔습니다.` });
      return;
    }
    const left = [...previousParticipants.entries()].filter(([participantId]) => (
      participantId && participantId !== previousRoom.viewerId && !nextParticipants.has(participantId)
    ));
    if (left.length > 0) {
      const name = left[0][1]?.name || '참가자';
      const suffix = left.length > 1 ? ` 외 ${left.length - 1}명` : '';
      announce('participantLeave', { message: `${name}님${suffix}이 방을 나갔습니다.` });
    }
  }, [announce]);

  const applyRoomResponse = useCallback((data) => {
    const previousRoom = roomRef.current;
    const nextRoom = normalizeRoom(data);
    if (nextRoom) {
      roomRef.current = nextRoom;
      setRoom(nextRoom);
    }
    return { previousRoom, nextRoom };
  }, []);

  useEffect(() => {
    if (!id || room?.status !== 'active') return undefined;
    let disposed = false;

    const refreshRoom = async () => {
      if (disposed || document.visibilityState !== 'visible' || submittingRef.current) return;
      try {
        const data = await apiGet(`/twenty-questions/${id}`, { timeoutMs: 8000 });
        const nextRoom = normalizeRoom(data);
        const previousRoom = roomRef.current;
        if (!nextRoom || roomVersion(previousRoom) === roomVersion(nextRoom)) return;
        roomRef.current = nextRoom;
        setRoom(nextRoom);
        announceRemoteRoomChange(previousRoom, nextRoom);
      } catch {
        // Polling is intentionally silent; explicit actions still surface API errors.
      }
    };

    const timer = window.setInterval(refreshRoom, ROOM_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshRoom();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [announceRemoteRoomChange, id, room?.status]);

  useEffect(() => {
    if (!id || !hydrated || !token || room?.status !== 'active') return undefined;
    let disposed = false;

    const heartbeat = async () => {
      if (disposed || document.visibilityState !== 'visible') return;
      try {
        const data = await apiPost(`/twenty-questions/${id}/presence`, {}, { timeoutMs: 8000 });
        if (disposed) return;
        const previousRoom = roomRef.current;
        const nextRoom = normalizeRoom(data);
        if (!nextRoom || roomVersion(previousRoom) === roomVersion(nextRoom)) return;
        roomRef.current = nextRoom;
        setRoom(nextRoom);
        announceRemoteRoomChange(previousRoom, nextRoom);
      } catch {
        // Presence updates are silent; the normal room poll remains authoritative.
      }
    };

    void heartbeat();
    const timer = window.setInterval(heartbeat, PRESENCE_HEARTBEAT_INTERVAL_MS);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [announceRemoteRoomChange, hydrated, id, room?.status, token]);

  const clearRoomCaches = () => {
    clearApiGetCache(`/twenty-questions/${id}`);
    clearApiGetCache('/twenty-questions');
    clearApiGetCache('/public/home-hub');
    clearApiGetCache('/public/search');
    clearApiGetCache('/public/users');
  };

  const addQuestion = async () => {
    const text = questionText.trim();
    if (!text) {
      const message = '질문을 입력해주세요.';
      announce('invalid', { ok: false, message });
      showToast({ tone: 'warning', message });
      return;
    }
    if (!canUseAttempt) {
      const message = '질문/정답 도전 횟수를 모두 사용했습니다.';
      announce('exhausted', { message });
      showToast({ tone: 'warning', message });
      return;
    }
    setSubmitting('question');
    try {
      const data = await apiPost(`/twenty-questions/${id}/questions`, { text }, { timeoutMs: 15000 });
      const applied = applyRoomResponse(data);
      clearRoomCaches();
      setQuestionText('');
      const message = data?.message || '질문을 등록했습니다.';
      const milestone = twentyQuestionsProgressTransition(applied.previousRoom, applied.nextRoom);
      announce(milestone || 'question', { message: progressFeedbackMessage(milestone, message) });
      showToast({ tone: 'success', message });
    } catch (err) {
      const message = err?.message || '질문 등록에 실패했습니다.';
      announce('questionFailure', { ok: false, message });
      showToast({ tone: 'danger', message });
    } finally {
      setSubmitting('');
    }
  };

  const answerQuestion = async (questionId, response) => {
    if (!questionId || !response) return;
    setSubmitting(`answer:${questionId}:${response}`);
    try {
      const data = await apiPost(`/twenty-questions/${id}/questions/${questionId}/answer`, { response }, { timeoutMs: 15000 });
      applyRoomResponse(data);
      clearRoomCaches();
      const message = data?.message || '답변을 저장했습니다.';
      announce(data?.exhausted ? 'limitReveal' : 'answer', { response, message });
      showToast({ tone: 'success', message });
    } catch (err) {
      const message = err?.message || '답변 저장에 실패했습니다.';
      announce('answerFailure', { ok: false, message });
      showToast({ tone: 'danger', message });
    } finally {
      setSubmitting('');
    }
  };

  const submitGuess = async () => {
    const text = guessText.trim();
    if (!text) {
      const message = '정답 도전을 입력해주세요.';
      announce('invalid', { ok: false, message });
      showToast({ tone: 'warning', message });
      return;
    }
    if (!canUseAttempt) {
      const message = '질문/정답 도전 횟수를 모두 사용했습니다.';
      announce('exhausted', { message });
      showToast({ tone: 'warning', message });
      return;
    }
    setSubmitting('guess');
    try {
      const data = await apiPost(`/twenty-questions/${id}/guesses`, { text }, { timeoutMs: 15000 });
      const applied = applyRoomResponse(data);
      clearRoomCaches();
      setGuessText('');
      const message = data?.message || '정답 도전을 기록했습니다.';
      const milestone = !data?.correct && !data?.exhausted
        ? twentyQuestionsProgressTransition(applied.previousRoom, applied.nextRoom)
        : '';
      const feedbackAction = data?.exhausted ? 'limitReveal' : milestone || 'guess';
      announce(feedbackAction, { correct: data?.correct, message: progressFeedbackMessage(milestone, message) });
      showToast({ tone: data?.correct ? 'success' : 'warning', message });
    } catch (err) {
      const message = err?.message || '정답 도전에 실패했습니다.';
      announce('guessFailure', { ok: false, message });
      showToast({ tone: 'danger', message });
    } finally {
      setSubmitting('');
    }
  };

  const sendHintMessage = async () => {
    const text = hintText.trim();
    if (!text) {
      const message = '힌트를 입력해주세요.';
      announce('invalid', { ok: false, message });
      showToast({ tone: 'warning', message });
      return;
    }
    if (!room?.isHost || !active) {
      const message = '방장만 진행 중인 방에 힌트를 남길 수 있습니다.';
      announce('hostOnly', { message });
      showToast({ tone: 'warning', message });
      return;
    }
    setSubmitting('hint');
    try {
      const data = await apiPost(`/twenty-questions/${id}/hints`, { text }, { timeoutMs: 15000 });
      applyRoomResponse(data);
      clearRoomCaches();
      setHintText('');
      const message = data?.message || '힌트를 등록했습니다.';
      announce('hint', { message });
      showToast({ tone: 'success', message });
    } catch (err) {
      const message = err?.message || '힌트 등록에 실패했습니다.';
      announce('hintFailure', { ok: false, message });
      showToast({ tone: 'danger', message });
    } finally {
      setSubmitting('');
    }
  };

  const closeRoom = async () => {
    if (!window.confirm('이 방을 종료할까요?')) return;
    setSubmitting('close');
    try {
      const data = await apiPost(`/twenty-questions/${id}/close`, {}, { timeoutMs: 15000 });
      applyRoomResponse(data);
      clearRoomCaches();
      const message = data?.message || '방을 종료했습니다.';
      announce('close', { message });
      showToast({ tone: 'success', message });
    } catch (err) {
      const message = err?.message || '방 종료에 실패했습니다.';
      announce('closeFailure', { ok: false, message });
      showToast({ tone: 'danger', message });
    } finally {
      setSubmitting('');
    }
  };

  return (
    <main
      className="twenty-page twenty-page--viewport twenty-page--room"
      onChangeCapture={handleGameSfxChangeCapture}
      onPointerDownCapture={handleGameSfxPointerDownCapture}
    >
      <SiteHeader />
      <section className="twenty-shell">
        <div className="twenty-head">
          <div>
            <p className="twenty-eyebrow">Twenty Questions</p>
            <h1>{room?.title || '스무고개 방'}</h1>
          </div>
          <div className="twenty-head-actions">
            {room?.isHost && active ? (
              <GameControlButton action="close" cue="off" className="twenty-button twenty-danger" onClick={closeRoom} disabled={submitting === 'close'}>
                종료
              </GameControlButton>
            ) : null}
            <Link href="/twenty-questions" className="twenty-button twenty-button-secondary game-control-button" data-game-sfx="nav">
              <GameActionIcon action="room" label="목록" />
              <span className="game-action-button__label">목록</span>
            </Link>
          </div>
        </div>

        <TwentyQuestionsFeedbackBar feedback={actionFeedback} />

        {loading ? (
          <div className="twenty-empty twenty-inline-state">
            <GameActionIcon action="wait" label="방 불러오는 중" />
            <span>방을 불러오는 중입니다.</span>
          </div>
        ) : null}
        {!loading && !room ? (
          <div className="twenty-empty twenty-error twenty-room-load-error">
            <GameActionIcon action="warning" label="방 불러오기 실패" />
            <span>{loadError || '방을 찾을 수 없습니다.'}</span>
            <GameControlButton action="refresh" onClick={() => void loadRoom()}>다시 불러오기</GameControlButton>
            <GameControlButton action="room" className="twenty-button-secondary" onClick={() => router.push('/twenty-questions')}>목록으로</GameControlButton>
          </div>
        ) : null}

        {!loading && room ? (
          <div className="twenty-room-body">
            <section className="twenty-room-summary">
              <div className="twenty-room-flags">
                <span className={`twenty-status is-${room.status}`}>
                  <GameActionIcon action={roomStatusAction(room.status)} label={statusLabel(room.status)} />
                  {statusLabel(room.status)}
                </span>
                <span className="twenty-pill">
                  <GameActionIcon action="category" label="주제" />
                  {room.categoryLabel}
                </span>
              </div>
              <dl>
                <div>
                  <dt><GameActionIcon action="host" label="방장" />방장</dt>
                  <dd>
                    {userProfileHref(room.hostId) ? (
                      <Link href={userProfileHref(room.hostId)} className="profile-inline-link">{room.hostName}</Link>
                    ) : room.hostName}
                  </dd>
                </div>
                <div><dt><GameActionIcon action="participant-count" label="접속 참가자" />접속</dt><dd>{room.participantCount}</dd></div>
                <div><dt><GameActionIcon action="attempt-limit" label="사용 횟수" />사용</dt><dd>{room.attemptCount}/{room.maxQuestions}</dd></div>
                <div><dt><GameActionIcon action="wait" label="남은 횟수" />남은 횟수</dt><dd>{attemptsLeft}</dd></div>
                <div><dt><GameActionIcon action="question" label="질문" />질문</dt><dd>{room.questionCount}</dd></div>
                <div><dt><GameActionIcon action="guess" label="정답 도전" />정답 도전</dt><dd>{room.guessCount}</dd></div>
              </dl>
              <TwentyQuestionsAttemptMeter progress={roomProgress} />
              {room.hint ? (
                <p className="twenty-hint twenty-inline-state">
                  <GameActionIcon action="hint-message" label="힌트" />
                  <span>힌트: {room.hint}</span>
                </p>
              ) : null}
              {room.answerRevealed ? (
                <p className="twenty-answer twenty-inline-state">
                  <GameActionIcon
                    action={room.status === 'solved' ? 'guess-correct' : 'answer-reveal'}
                    label={room.status === 'solved' ? '정답 적중' : '정답 공개'}
                  />
                  <span>정답: <strong>{room.answer}</strong>{room.solvedByName ? ` · ${room.solvedByName}` : ''}</span>
                </p>
              ) : null}
            </section>

            {hydrated && !token ? (
              <div className="twenty-note twenty-inline-state">
                <GameActionIcon action="lock" label="로그인 필요" />
                <span>로그인하면 질문과 정답 도전을 할 수 있습니다.</span>
              </div>
            ) : null}

            <div className="twenty-room-workspace">
              <GameFeatureTabs
                activeTabId={activePanel}
                onTabChange={setActivePanel}
                tabs={[
                  {
                    id: 'deduction',
                    label: '추리',
                    icon: 'question',
                    cue: 'twentyTabDeduction',
                    badge: room.isHost ? String(pendingQuestions.length) : String(attemptsLeft),
                    children: (
                      <div className="twenty-tab-content twenty-tab-content--deduction">
                        {room.isHost && active ? (
                          <div className="twenty-role-note twenty-inline-state">
                            <GameActionIcon action="host" label="방장" />
                            <span>방장은 질문에 답하고 힌트를 공개합니다. 질문과 정답 도전은 참가자만 할 수 있습니다.</span>
                          </div>
                        ) : null}

                        {canInteract ? (
                          <section className="twenty-action-grid">
                            <div className="twenty-action-panel">
                              <div className="twenty-panel-title">
                                <strong><GameActionIcon action="question" label="질문" />질문</strong>
                                <span>{attemptsLeft}회 남음</span>
                              </div>
                              <textarea
                                value={questionText}
                                onChange={(event) => setQuestionText(event.target.value)}
                                placeholder={canUseAttempt ? '예/아니오로 답할 수 있는 질문' : '질문/정답 도전 횟수를 모두 사용했습니다'}
                                rows={3}
                                maxLength={220}
                                disabled={!canUseAttempt}
                              />
                              <GameControlButton action="question" cue="off" onClick={addQuestion} disabled={!canUseAttempt || submitting === 'question'}>
                                {submitting === 'question' ? '등록 중...' : '질문하기'}
                              </GameControlButton>
                            </div>

                            <div className="twenty-action-panel">
                              <div className="twenty-panel-title">
                                <strong><GameActionIcon action="guess" label="정답 도전" />정답 도전</strong>
                                <span>{attemptsLeft}회 남음</span>
                              </div>
                              <input
                                value={guessText}
                                onChange={(event) => setGuessText(event.target.value)}
                                placeholder={canUseAttempt ? '정답 입력' : '질문/정답 도전 횟수를 모두 사용했습니다'}
                                maxLength={120}
                                disabled={!canUseAttempt}
                              />
                              <GameControlButton action="guess" cue="off" onClick={submitGuess} disabled={!canUseAttempt || submitting === 'guess'}>
                                {submitting === 'guess' ? '도전 중...' : '도전'}
                              </GameControlButton>
                            </div>
                          </section>
                        ) : null}

                        {hydrated && token && active && !room.isHost && !canUseAttempt ? (
                          <div className="twenty-note twenty-inline-state">
                            <GameActionIcon action="attempt-limit" label="횟수 소진" />
                            <span>20회를 모두 사용했습니다. 대기 중인 질문에 방장이 답하면 정답이 공개됩니다.</span>
                          </div>
                        ) : null}

                        {room.isHost ? (
                          <section className="twenty-host-panel">
                            <div className="twenty-panel-title">
                              <strong><GameActionIcon action="question-queued" label="답변 대기" />답변 대기</strong>
                              <span>{pendingQuestions.length}</span>
                            </div>
                            {pendingQuestions.length === 0 ? (
                              <div className="twenty-empty compact twenty-inline-state">
                                <GameActionIcon action="answer-pending" label="답변 대기 없음" />
                                <span>대기 중인 질문이 없습니다.</span>
                              </div>
                            ) : null}
                            {pendingQuestions.map((question) => (
                              <div className="twenty-pending-row" key={question._id}>
                                <p><GameActionIcon action="answer-pending" label="답변 대기" /><span>{question.text}</span></p>
                                <div>
                                  {RESPONSE_OPTIONS.map((option) => (
                                    <GameControlButton
                                      action={`answer-${option.value}`}
                                      cue="off"
                                      key={option.value}
                                      onClick={() => answerQuestion(question._id, option.value)}
                                      disabled={!active || submitting.startsWith(`answer:${question._id}:`)}
                                    >
                                      {option.label}
                                    </GameControlButton>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </section>
                        ) : null}

                        {!active ? (
                          <div className="twenty-note twenty-inline-state">
                            <GameActionIcon action={roomStatusAction(room.status)} label={statusLabel(room.status)} />
                            <span>{room.status === 'solved' ? '정답을 맞혀 추리가 종료되었습니다.' : '이 방의 추리가 종료되었습니다.'}</span>
                          </div>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    id: 'hints',
                    label: '힌트',
                    icon: 'hint',
                    cue: 'twentyTabHints',
                    badge: String(hintMessages.length),
                    children: (
                      <div className="twenty-tab-content">
                        <section className="twenty-chat-panel">
                          <div className="twenty-panel-title">
                            <strong><GameActionIcon action="hint" label="힌트 채팅" />힌트 채팅</strong>
                            <span>{hintMessages.length}</span>
                          </div>
                          <div className="twenty-chat-list">
                            {hintMessages.length === 0 ? (
                              <div className="twenty-empty compact twenty-inline-state">
                                <GameActionIcon action="hint-message" label="힌트 없음" />
                                <span>아직 힌트가 없습니다.</span>
                              </div>
                            ) : null}
                            {hintMessages.map((message, index) => (
                              <article className="twenty-chat-message" key={message._id || index}>
                                <div>
                                  <strong><GameActionIcon action="hint-message" label="방장 힌트" />{message.authorName || room.hostName || '방장'}</strong>
                                  <small>{formatDate(message.createdAt)}</small>
                                </div>
                                <p>{message.text}</p>
                              </article>
                            ))}
                          </div>
                          {room.isHost && active ? (
                            <div className="twenty-chat-input">
                              <textarea
                                value={hintText}
                                onChange={(event) => setHintText(event.target.value)}
                                placeholder="참가자에게 공개할 힌트"
                                rows={3}
                                maxLength={240}
                                disabled={submitting === 'hint'}
                              />
                              <GameControlButton action="hint" cue="off" onClick={sendHintMessage} disabled={submitting === 'hint'}>
                                {submitting === 'hint' ? '등록 중...' : '힌트 등록'}
                              </GameControlButton>
                            </div>
                          ) : active ? (
                            <div className="twenty-chat-locked twenty-inline-state">
                              <GameActionIcon action="lock" label="방장 전용" />
                              <span>방장만 힌트를 남길 수 있습니다.</span>
                            </div>
                          ) : null}
                        </section>
                      </div>
                    ),
                  },
                  {
                    id: 'history',
                    label: '기록',
                    icon: 'history',
                    cue: 'twentyTabHistory',
                    badge: String(attemptTimeline.length),
                    children: (
                      <div className="twenty-tab-content">
                        <section className="twenty-history-panel twenty-history-panel--timeline">
                          <div className="twenty-panel-title">
                            <strong><GameActionIcon action="history" label="시도 기록" />시도 기록</strong>
                            <span>{attemptTimeline.length}/{room.maxQuestions}</span>
                          </div>
                          {attemptTimeline.length === 0 ? (
                            <div className="twenty-empty compact twenty-inline-state">
                              <GameActionIcon action="history" label="시도 기록 없음" />
                              <span>아직 질문이나 정답 도전이 없습니다.</span>
                            </div>
                          ) : null}
                          <div className="twenty-timeline">
                            {attemptTimeline.map((entry) => {
                              const isQuestion = entry.kind === 'question';
                              const outcomeAction = isQuestion
                                ? responseAction(entry.response)
                                : entry.correct ? 'guess-correct' : 'guess-wrong';
                              const outcomeLabel = isQuestion
                                ? entry.responseLabel
                                : entry.correct ? '정답' : '오답';
                              const outcomeClass = isQuestion
                                ? entry.response || 'pending'
                                : entry.correct ? 'yes' : 'no';
                              return (
                                <article className={`twenty-history-item ${entry.correct ? 'is-correct' : ''}`} key={`${entry.kind}-${entry.id}`}>
                                  <div className="twenty-history-head">
                                    <span className="twenty-history-identity">
                                      <GameActionIcon action={isQuestion ? 'question' : 'guess'} label={isQuestion ? '질문' : '정답 도전'} />
                                      #{entry.attemptNo} {isQuestion ? '질문' : '정답 도전'}
                                    </span>
                                    <span className={`twenty-response is-${outcomeClass}`}>
                                      <GameActionIcon action={outcomeAction} label={outcomeLabel} />
                                      {outcomeLabel}
                                    </span>
                                  </div>
                                  <p>{entry.text}</p>
                                  <small>{entry.actorName} · {formatDate(entry.createdAt)}</small>
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
