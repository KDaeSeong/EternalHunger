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
import { GameControlButton } from '../../games/_components/GamePlayPrimitives';
import { useGameSfxEventHandlers } from '../../games/_lib/useGameSfx';
import { twentyQuestionsFeedback } from '../_lib/twentyQuestionsFeedback';
import {
  resolveTwentyQuestionsRoomBgmScene,
  twentyQuestionsResultMusic,
} from '../_lib/twentyQuestionsSoundtrack';
import TwentyQuestionsFeedbackBar from './TwentyQuestionsFeedbackBar';

const RESPONSE_OPTIONS = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니오' },
  { value: 'maybe', label: '애매함' },
];

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
    isHost: Boolean(row.isHost),
    questions,
    guesses,
    hintMessages,
  };
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
  const [questionText, setQuestionText] = useState('');
  const [guessText, setGuessText] = useState('');
  const [hintText, setHintText] = useState('');
  const [submitting, setSubmitting] = useState('');
  const [actionFeedback, setActionFeedback] = useState(null);
  const musicBaseSceneRef = useRef('');
  const musicSceneTimerRef = useRef(null);
  const {
    handleGameSfxChangeCapture,
    handleGameSfxPointerDownCapture,
    playGameSfx,
  } = useGameSfxEventHandlers({ theme: 'twenty' });

  const loadRoom = useCallback(async () => {
    if (!id) {
      setRoom(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet(`/twenty-questions/${id}`, { timeoutMs: 15000 });
      setRoom(normalizeRoom(data));
    } catch (err) {
      setRoom(null);
      showToast({ tone: 'danger', message: err?.message || '스무고개 방을 불러오지 못했습니다.' });
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void Promise.resolve().then(loadRoom);
  }, [loadRoom]);

  const pendingQuestions = useMemo(
    () => normalizeList(room?.questions).filter((question) => question?.response === 'pending'),
    [room?.questions]
  );
  const hintMessages = useMemo(
    () => normalizeList(room?.hintMessages),
    [room?.hintMessages]
  );
  const active = room?.status === 'active';
  const attemptsLeft = Math.max(0, Number(room?.remainingCount != null ? room.remainingCount : Number(room?.maxQuestions || 20) - Number(room?.attemptCount || 0)));
  const canInteract = hydrated && token && active;
  const canUseAttempt = canInteract && attemptsLeft > 0;
  const baseMusicScene = useMemo(() => resolveTwentyQuestionsRoomBgmScene({
    status: room?.status,
    answerRevealed: room?.answerRevealed,
    attemptsLeft,
    pendingCount: pendingQuestions.length,
    isHost: room?.isHost,
    submitting,
  }), [attemptsLeft, pendingQuestions.length, room?.answerRevealed, room?.isHost, room?.status, submitting]);

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

  const applyRoomResponse = (data) => {
    const nextRoom = normalizeRoom(data);
    if (nextRoom) setRoom(nextRoom);
  };

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
      applyRoomResponse(data);
      clearRoomCaches();
      setQuestionText('');
      const message = data?.message || '질문을 등록했습니다.';
      announce('question', { message });
      showToast({ tone: 'success', message });
    } catch (err) {
      const message = err?.message || '질문 등록에 실패했습니다.';
      announce('invalid', { ok: false, message });
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
      announce('answer', { response, message });
      showToast({ tone: 'success', message });
    } catch (err) {
      const message = err?.message || '답변 저장에 실패했습니다.';
      announce('invalid', { ok: false, message });
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
      applyRoomResponse(data);
      clearRoomCaches();
      setGuessText('');
      const message = data?.message || '정답 도전을 기록했습니다.';
      announce('guess', { correct: data?.correct, message });
      showToast({ tone: data?.correct ? 'success' : 'warning', message });
    } catch (err) {
      const message = err?.message || '정답 도전에 실패했습니다.';
      announce('invalid', { ok: false, message });
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
      announce('invalid', { ok: false, message });
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
      announce('invalid', { ok: false, message });
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
              <GameControlButton action="close" cue="warning" className="twenty-button twenty-danger" onClick={closeRoom} disabled={submitting === 'close'}>
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

        {loading ? <div className="twenty-empty">방을 불러오는 중입니다.</div> : null}
        {!loading && !room ? (
          <div className="twenty-empty">
            방을 찾을 수 없습니다.
            <GameControlButton action="room" className="twenty-button" onClick={() => router.push('/twenty-questions')}>목록으로</GameControlButton>
          </div>
        ) : null}

        {!loading && room ? (
          <>
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
                <div><dt><GameActionIcon action="attempt-limit" label="사용 횟수" />사용</dt><dd>{room.attemptCount}/{room.maxQuestions}</dd></div>
                <div><dt><GameActionIcon action="wait" label="남은 횟수" />남은 횟수</dt><dd>{attemptsLeft}</dd></div>
                <div><dt><GameActionIcon action="question" label="질문" />질문</dt><dd>{room.questionCount}</dd></div>
                <div><dt><GameActionIcon action="guess" label="정답 도전" />정답 도전</dt><dd>{room.guessCount}</dd></div>
              </dl>
              {room.hint ? (
                <p className="twenty-hint twenty-inline-state">
                  <GameActionIcon action="hint-message" label="힌트" />
                  <span>힌트: {room.hint}</span>
                </p>
              ) : null}
              {room.answerRevealed ? (
                <p className="twenty-answer twenty-inline-state">
                  <GameActionIcon action="guess-correct" label="정답" />
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
                    rows={4}
                    maxLength={220}
                    disabled={!canUseAttempt}
                  />
                  <GameControlButton action="question" onClick={addQuestion} disabled={!canUseAttempt || submitting === 'question'}>
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
                  <GameControlButton action="guess" onClick={submitGuess} disabled={!canUseAttempt || submitting === 'guess'}>
                    {submitting === 'guess' ? '도전 중...' : '도전'}
                  </GameControlButton>
                </div>
              </section>
            ) : null}

            <section className="twenty-chat-panel">
              <div className="twenty-panel-title">
                <strong><GameActionIcon action="hint" label="힌트 채팅" />힌트 채팅</strong>
                <span>{hintMessages.length}</span>
              </div>
              <div className="twenty-chat-list">
                {hintMessages.length === 0 ? <div className="twenty-empty compact">아직 힌트가 없습니다.</div> : null}
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
                  <GameControlButton action="hint" onClick={sendHintMessage} disabled={submitting === 'hint'}>
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

            {room.isHost && pendingQuestions.length > 0 ? (
              <section className="twenty-host-panel">
                <div className="twenty-panel-title">
                  <strong><GameActionIcon action="question" label="답변 대기" />답변 대기</strong>
                  <span>{pendingQuestions.length}</span>
                </div>
                {pendingQuestions.map((question) => (
                  <div className="twenty-pending-row" key={question._id}>
                    <p><GameActionIcon action="answer-pending" label="답변 대기" /><span>{question.text}</span></p>
                    <div>
                      {RESPONSE_OPTIONS.map((option) => (
                        <GameControlButton
                          action={`answer-${option.value}`}
                          key={option.value}
                          onClick={() => answerQuestion(question._id, option.value)}
                          disabled={submitting.startsWith(`answer:${question._id}:`)}
                        >
                          {option.label}
                        </GameControlButton>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="twenty-history-grid">
              <div className="twenty-history-panel">
                <div className="twenty-panel-title">
                  <strong><GameActionIcon action="question" label="질문 기록" />질문 기록</strong>
                  <span>{room.questions.length}</span>
                </div>
                {room.questions.length === 0 ? <div className="twenty-empty compact">아직 질문이 없습니다.</div> : null}
                {room.questions.map((question, index) => (
                  <article className="twenty-history-item" key={question._id || index}>
                    <div className="twenty-history-head">
                      <span className="twenty-history-identity"><GameActionIcon action="question" label="질문" />Q{index + 1}</span>
                      <span className={`twenty-response is-${question.response || 'pending'}`}>
                        <GameActionIcon action={responseAction(question.response)} label={question.responseLabel || '대기'} />
                        {question.responseLabel || '대기'}
                      </span>
                    </div>
                    <p>{question.text}</p>
                    <small>{question.askerName || '익명'} · {formatDate(question.createdAt)}</small>
                  </article>
                ))}
              </div>

              <div className="twenty-history-panel">
                <div className="twenty-panel-title">
                  <strong><GameActionIcon action="guess" label="정답 도전 기록" />정답 도전 기록</strong>
                  <span>{room.guesses.length}</span>
                </div>
                {room.guesses.length === 0 ? <div className="twenty-empty compact">아직 도전이 없습니다.</div> : null}
                {room.guesses.map((guess, index) => (
                  <article className={`twenty-history-item ${guess.correct ? 'is-correct' : ''}`} key={guess._id || index}>
                    <div className="twenty-history-head">
                      <span className="twenty-history-identity"><GameActionIcon action="guess" label="정답 도전" />{guess.guesserName || '익명'}</span>
                      <span className={`twenty-response ${guess.correct ? 'is-yes' : 'is-no'}`}>
                        <GameActionIcon action={guess.correct ? 'guess-correct' : 'guess-wrong'} label={guess.correct ? '정답' : '오답'} />
                        {guess.correct ? '정답' : '오답'}
                      </span>
                    </div>
                    <p>{guess.text}</p>
                    <small>{formatDate(guess.createdAt)}</small>
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
