'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiGet, apiPost, clearApiGetCache } from '../../../utils/api';
import { useAuthToken, useHydrated } from '../../../utils/client-auth';

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

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRoom(payload) {
  const row = payload?.room || payload?.data || payload;
  if (!row || typeof row !== 'object') return null;
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
    maxQuestions: Number(row.maxQuestions || 20),
    questionCount: Number(row.questionCount || normalizeList(row.questions).length),
    pendingCount: Number(row.pendingCount || 0),
    guessCount: Number(row.guessCount || normalizeList(row.guesses).length),
    answer: safeText(row.answer, ''),
    answerRevealed: Boolean(row.answerRevealed),
    isHost: Boolean(row.isHost),
    questions: normalizeList(row.questions),
    guesses: normalizeList(row.guesses),
  };
}

export default function TwentyQuestionsRoomPage() {
  const params = useParams();
  const router = useRouter();
  const id = normalizeRouteId(params?.id);
  const hydrated = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [questionText, setQuestionText] = useState('');
  const [guessText, setGuessText] = useState('');
  const [submitting, setSubmitting] = useState('');

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
    void loadRoom();
  }, [loadRoom]);

  const pendingQuestions = useMemo(
    () => normalizeList(room?.questions).filter((question) => question?.response === 'pending'),
    [room?.questions]
  );
  const active = room?.status === 'active';
  const questionsLeft = Math.max(0, Number(room?.maxQuestions || 20) - Number(room?.questionCount || 0));
  const canInteract = hydrated && token && active;
  const canAsk = canInteract && questionsLeft > 0;

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
      showToast({ tone: 'warning', message: '질문을 입력해주세요.' });
      return;
    }
    setSubmitting('question');
    try {
      const data = await apiPost(`/twenty-questions/${id}/questions`, { text }, { timeoutMs: 15000 });
      applyRoomResponse(data);
      clearRoomCaches();
      setQuestionText('');
      showToast({ tone: 'success', message: data?.message || '질문을 등록했습니다.' });
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '질문 등록에 실패했습니다.' });
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
      showToast({ tone: 'success', message: data?.message || '답변을 저장했습니다.' });
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '답변 저장에 실패했습니다.' });
    } finally {
      setSubmitting('');
    }
  };

  const submitGuess = async () => {
    const text = guessText.trim();
    if (!text) {
      showToast({ tone: 'warning', message: '정답 도전을 입력해주세요.' });
      return;
    }
    setSubmitting('guess');
    try {
      const data = await apiPost(`/twenty-questions/${id}/guesses`, { text }, { timeoutMs: 15000 });
      applyRoomResponse(data);
      clearRoomCaches();
      setGuessText('');
      showToast({ tone: data?.correct ? 'success' : 'warning', message: data?.message || '정답 도전을 기록했습니다.' });
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '정답 도전에 실패했습니다.' });
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
      showToast({ tone: 'success', message: data?.message || '방을 종료했습니다.' });
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '방 종료에 실패했습니다.' });
    } finally {
      setSubmitting('');
    }
  };

  return (
    <main className="twenty-page">
      <SiteHeader />
      <section className="twenty-shell">
        <div className="twenty-head">
          <div>
            <p className="twenty-eyebrow">Twenty Questions</p>
            <h1>{room?.title || '스무고개 방'}</h1>
          </div>
          <div className="twenty-head-actions">
            {room?.isHost && active ? (
              <button type="button" className="twenty-button twenty-danger" onClick={closeRoom} disabled={submitting === 'close'}>
                종료
              </button>
            ) : null}
            <Link href="/twenty-questions" className="twenty-button twenty-button-secondary">목록</Link>
          </div>
        </div>

        {loading ? <div className="twenty-empty">방을 불러오는 중입니다.</div> : null}
        {!loading && !room ? (
          <div className="twenty-empty">
            방을 찾을 수 없습니다.
            <button type="button" className="twenty-button" onClick={() => router.push('/twenty-questions')}>목록으로</button>
          </div>
        ) : null}

        {!loading && room ? (
          <>
            <section className="twenty-room-summary">
              <div>
                <span className={`twenty-status is-${room.status}`}>{statusLabel(room.status)}</span>
                <span className="twenty-pill">{room.categoryLabel}</span>
              </div>
              <dl>
                <div>
                  <dt>방장</dt>
                  <dd>
                    {userProfileHref(room.hostId) ? (
                      <Link href={userProfileHref(room.hostId)} className="profile-inline-link">{room.hostName}</Link>
                    ) : room.hostName}
                  </dd>
                </div>
                <div><dt>질문</dt><dd>{room.questionCount}/{room.maxQuestions}</dd></div>
                <div><dt>남은 질문</dt><dd>{questionsLeft}</dd></div>
                <div><dt>정답 도전</dt><dd>{room.guessCount}</dd></div>
              </dl>
              {room.hint ? <p className="twenty-hint">힌트: {room.hint}</p> : null}
              {room.answerRevealed ? (
                <p className="twenty-answer">정답: <strong>{room.answer}</strong>{room.solvedByName ? ` · ${room.solvedByName}` : ''}</p>
              ) : null}
            </section>

            {hydrated && !token ? (
              <div className="twenty-note">로그인하면 질문과 정답 도전을 할 수 있습니다.</div>
            ) : null}

            {canInteract ? (
              <section className="twenty-action-grid">
                <div className="twenty-action-panel">
                  <div className="twenty-panel-title">
                    <strong>질문</strong>
                    <span>{questionsLeft}개 남음</span>
                  </div>
                  <textarea
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    placeholder={canAsk ? '예/아니오로 답할 수 있는 질문' : '질문을 모두 사용했습니다'}
                    rows={4}
                    maxLength={220}
                    disabled={!canAsk}
                  />
                  <button type="button" onClick={addQuestion} disabled={!canAsk || submitting === 'question'}>
                    {submitting === 'question' ? '등록 중...' : '질문하기'}
                  </button>
                </div>

                <div className="twenty-action-panel">
                  <div className="twenty-panel-title">
                    <strong>정답 도전</strong>
                    <span>{statusLabel(room.status)}</span>
                  </div>
                  <input
                    value={guessText}
                    onChange={(event) => setGuessText(event.target.value)}
                    placeholder="정답 입력"
                    maxLength={120}
                  />
                  <button type="button" onClick={submitGuess} disabled={submitting === 'guess'}>
                    {submitting === 'guess' ? '도전 중...' : '도전'}
                  </button>
                </div>
              </section>
            ) : null}

            {room.isHost && pendingQuestions.length > 0 ? (
              <section className="twenty-host-panel">
                <div className="twenty-panel-title">
                  <strong>답변 대기</strong>
                  <span>{pendingQuestions.length}</span>
                </div>
                {pendingQuestions.map((question) => (
                  <div className="twenty-pending-row" key={question._id}>
                    <p>{question.text}</p>
                    <div>
                      {RESPONSE_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option.value}
                          onClick={() => answerQuestion(question._id, option.value)}
                          disabled={submitting.startsWith(`answer:${question._id}:`)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="twenty-history-grid">
              <div className="twenty-history-panel">
                <div className="twenty-panel-title">
                  <strong>질문 기록</strong>
                  <span>{room.questions.length}</span>
                </div>
                {room.questions.length === 0 ? <div className="twenty-empty compact">아직 질문이 없습니다.</div> : null}
                {room.questions.map((question, index) => (
                  <article className="twenty-history-item" key={question._id || index}>
                    <div className="twenty-history-head">
                      <span>Q{index + 1}</span>
                      <span className={`twenty-response is-${question.response || 'pending'}`}>
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
                  <strong>정답 도전 기록</strong>
                  <span>{room.guesses.length}</span>
                </div>
                {room.guesses.length === 0 ? <div className="twenty-empty compact">아직 도전이 없습니다.</div> : null}
                {room.guesses.map((guess, index) => (
                  <article className={`twenty-history-item ${guess.correct ? 'is-correct' : ''}`} key={guess._id || index}>
                    <div className="twenty-history-head">
                      <span>{guess.guesserName || '익명'}</span>
                      <span className={`twenty-response ${guess.correct ? 'is-yes' : 'is-no'}`}>
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
