'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiDelete, apiGetCached, apiPost, apiPut, clearApiGetCache } from '../../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../../utils/client-auth';

const BOARD_CATEGORIES = [
  { value: 'free', label: '자유' },
  { value: 'guide', label: '공략' },
  { value: 'feedback', label: '피드백' },
  { value: 'bug', label: '버그' },
  { value: 'simulation', label: '시뮬레이션' },
  { value: 'game', label: '게임' },
];

function formatDate(value) {
  if (!value) return '날짜 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 없음';
  return date.toLocaleString('ko-KR');
}

function getUserId(user) {
  return user?._id || user?.id || user?.userId || '';
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

function safeText(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim();
    return text || fallback;
  }
  return fallback;
}

function normalizeComment(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const authorId = row.authorId || row.userId || row.author?._id || row.author?.id || row.user?._id || row.user?.id || '';
  return {
    ...row,
    _normalizedId: normalizeIdValue(row._id || row.id),
    authorId,
    authorName: safeText(row.author?.nickname || row.user?.nickname || authorId?.nickname || row.authorName || row.username || row.author?.username || row.user?.username || authorId?.username, '익명'),
    content: safeText(row.content, ''),
    createdAt: row.createdAt || row.created_at || row.date || '',
    updatedAt: row.updatedAt || row.updated_at || '',
  };
}

function normalizePost(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const authorId = row.authorId || row.userId || row.author?._id || row.author?.id || row.user?._id || row.user?.id || '';
  const comments = Array.isArray(row.comments) ? row.comments.map(normalizeComment).filter(Boolean) : [];
  return {
    ...row,
    title: safeText(row.title, '제목 없음'),
    content: safeText(row.content, ''),
    category: safeText(row.category, 'free'),
    categoryLabel: safeText(row.categoryLabel, '자유'),
    commentCount: Number(row.commentCount ?? comments.length ?? 0),
    isNotice: Boolean(row.isNotice),
    noticePinnedAt: row.noticePinnedAt || '',
    comments,
    createdAt: row.createdAt || row.created_at || row.date || '',
    updatedAt: row.updatedAt || row.updated_at || '',
    authorId,
    authorName: safeText(row.author?.nickname || row.user?.nickname || authorId?.nickname || row.authorName || row.username || row.author?.username || row.user?.username || authorId?.username, '익명'),
  };
}

function unwrapPost(data) {
  const post = data?.post || data?.data || data;
  return normalizePost(post);
}

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = normalizeRouteId(params?.id);

  const [post, setPost] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'free' });
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState('');
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportForm, setReportForm] = useState({ reason: 'other', detail: '' });
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const mounted = useHydrated();
  const token = useAuthToken();
  const user = useAuthUser();
  const { showToast } = useToast();
  const userId = useMemo(() => getUserId(user), [user]);

  const load = useCallback(async () => {
    await Promise.resolve();
    if (!id) {
      setLoading(false);
      setPost(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGetCached(`/posts/${id}`, {
        ttlMs: 10000,
        timeoutMs: 12000,
        storage: 'session',
      });
      const nextPost = unwrapPost(data);
      setPost(nextPost);
      setForm({ title: safeText(nextPost?.title, ''), content: safeText(nextPost?.content, ''), category: safeText(nextPost?.category, 'free') });
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const canEdit = mounted && token && userId && post && normalizeIdValue(post.authorId) === String(userId);
  const canManageNotice = mounted && token && Boolean(user?.isAdmin) && post;
  const comments = Array.isArray(post?.comments) ? post.comments : [];

  const applyPostResponse = (data) => {
    const nextPost = unwrapPost(data);
    if (!nextPost) return;
    setPost(nextPost);
    setForm({ title: safeText(nextPost?.title, ''), content: safeText(nextPost?.content, ''), category: safeText(nextPost?.category, 'free') });
  };

  const clearPostCaches = () => {
    clearApiGetCache(`/posts/${id}`);
    clearApiGetCache('/posts');
    clearApiGetCache('/public/home-hub');
    clearApiGetCache('/public/guides');
    clearApiGetCache('/public/search');
  };

  const save = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      const nextMessage = '제목과 내용을 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSaving(true);
    try {
      const res = await apiPut(`/posts/${id}`, { title, content, category: form.category || 'free' });
      const nextMessage = res?.message || '수정했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      clearPostCaches();
      setEditing(false);
      await load();
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글 수정에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/posts/${id}`);
      showToast({ tone: 'success', message: res?.message || '삭제했습니다.' });
      clearPostCaches();
      router.push('/board');
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글 삭제에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    }
  };

  const createComment = async () => {
    const content = commentText.trim();
    if (!content) {
      const nextMessage = '댓글 내용을 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setCommentSubmitting(true);
    try {
      const res = await apiPost(`/posts/${id}/comments`, { content });
      applyPostResponse(res);
      setCommentText('');
      const nextMessage = res?.message || '댓글을 작성했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      clearPostCaches();
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '댓글 작성에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const removeComment = async (commentId) => {
    if (!commentId || !window.confirm('댓글을 삭제할까요?')) return;
    setDeletingCommentId(commentId);
    try {
      const res = await apiDelete(`/posts/${id}/comments/${commentId}`);
      applyPostResponse(res);
      const nextMessage = res?.message || '댓글을 삭제했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      clearPostCaches();
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '댓글 삭제에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setDeletingCommentId('');
    }
  };

  const toggleNotice = async () => {
    if (!post) return;
    setNoticeSaving(true);
    try {
      const res = await apiPost(`/posts/${id}/notice`, { isNotice: !post.isNotice });
      applyPostResponse(res);
      const nextMessage = res?.message || '공지 상태를 변경했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      clearPostCaches();
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '공지 상태 변경에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setNoticeSaving(false);
    }
  };

  const openReport = (target) => {
    setReportTarget(target);
    setReportForm({ reason: 'other', detail: '' });
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    setReportSubmitting(true);
    try {
      const res = await apiPost('/reports', {
        targetType: reportTarget.targetType,
        postId: id,
        commentId: reportTarget.commentId || '',
        reason: reportForm.reason,
        detail: reportForm.detail.trim(),
      });
      const nextMessage = res?.message || '신고를 접수했습니다.';
      setMessage(nextMessage);
      setReportTarget(null);
      setReportForm({ reason: 'other', detail: '' });
      showToast({ tone: 'success', message: nextMessage });
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '신고 접수에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setReportSubmitting(false);
    }
  };

  return (
    <main className="board-page">
      <SiteHeader />
      <section className="board-shell">
        <div className="board-head">
          <div>
            <p className="board-eyebrow">Community</p>
            <h1>게시글</h1>
          </div>
          <Link href="/board" className="board-link-button">
            목록으로
          </Link>
        </div>

        {message ? <div className="board-message">{message}</div> : null}

        {loading ? (
          <div className="board-empty">게시글을 불러오는 중입니다.</div>
        ) : !post ? (
          <div className="board-empty">게시글을 찾을 수 없습니다.</div>
        ) : (
          <article className="board-post-view">
            {editing ? (
              <div className="board-editor board-editor-inline board-post-editor">
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  aria-label="게시글 분류"
                >
                  {BOARD_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="제목"
                  maxLength={120}
                />
                <textarea
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder="내용"
                  rows={10}
                />
                <div className="board-actions">
                  <button type="button" onClick={save} disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button type="button" className="board-secondary" onClick={() => setEditing(false)}>
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="board-post-head">
                  <div className={`board-post-kicker ${post.isNotice ? 'is-notice' : ''}`}>
                    {post.isNotice ? `공지 · ${post.categoryLabel}` : post.categoryLabel}
                  </div>
                  <h2>{safeText(post.title, '제목 없음')}</h2>
                </div>
                <dl className="board-post-meta">
                  <div>
                    <dt>작성자</dt>
                    <dd>
                      {userProfileHref(post.authorId) ? (
                        <Link href={userProfileHref(post.authorId)} className="profile-inline-link">
                          {safeText(post.authorName, '익명')}
                        </Link>
                      ) : safeText(post.authorName, '익명')}
                    </dd>
                  </div>
                  <div>
                    <dt>댓글</dt>
                    <dd>{Number(post.commentCount || comments.length)}</dd>
                  </div>
                  <div>
                    <dt>등록일</dt>
                    <dd>{formatDate(post.createdAt)}</dd>
                  </div>
                  {post.updatedAt && post.updatedAt !== post.createdAt ? (
                    <div>
                      <dt>수정일</dt>
                      <dd>{formatDate(post.updatedAt)}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="board-detail-content">{safeText(post.content, '')}</p>
              </>
            )}

            {canEdit ? (
              <div className="board-actions">
                {!editing ? (
                  <button type="button" className="board-secondary" onClick={() => setEditing(true)}>
                    수정
                  </button>
                ) : null}
                <button type="button" className="board-danger" onClick={remove}>
                  삭제
                </button>
              </div>
            ) : null}

            {mounted && token && !editing ? (
              <div className="board-actions board-report-actions">
                <button type="button" className="board-secondary" onClick={() => openReport({ targetType: 'post', label: '게시글' })}>
                  신고
                </button>
              </div>
            ) : null}

            {canManageNotice ? (
              <div className="board-actions board-admin-actions">
                <button
                  type="button"
                  className="board-secondary"
                  onClick={toggleNotice}
                  disabled={noticeSaving}
                >
                  {noticeSaving ? '저장 중...' : post.isNotice ? '공지 해제' : '공지 고정'}
                </button>
              </div>
            ) : null}

            {reportTarget ? (
              <section className="board-report-panel">
                <div className="board-comments-head">
                  <h3>{reportTarget.label} 신고</h3>
                </div>
                <div className="board-report-grid">
                  <select
                    value={reportForm.reason}
                    onChange={(event) => setReportForm({ ...reportForm, reason: event.target.value })}
                    aria-label="신고 사유"
                  >
                    <option value="spam">스팸</option>
                    <option value="abuse">욕설/비방</option>
                    <option value="spoiler">스포일러</option>
                    <option value="offtopic">주제 이탈</option>
                    <option value="other">기타</option>
                  </select>
                  <textarea
                    value={reportForm.detail}
                    onChange={(event) => setReportForm({ ...reportForm, detail: event.target.value })}
                    placeholder="상세 내용을 입력하세요"
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="board-actions board-report-submit">
                    <button type="button" onClick={submitReport} disabled={reportSubmitting}>
                      {reportSubmitting ? '접수 중...' : '신고 접수'}
                    </button>
                    <button type="button" className="board-secondary" onClick={() => setReportTarget(null)} disabled={reportSubmitting}>
                      취소
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="board-comments">
              <div className="board-comments-head">
                <h3>댓글 {comments.length}</h3>
              </div>

              {mounted && token ? (
                <div className="board-comment-form">
                  <textarea
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="댓글을 입력하세요"
                    rows={3}
                    maxLength={1200}
                  />
                  <button type="button" onClick={createComment} disabled={commentSubmitting}>
                    {commentSubmitting ? '작성 중...' : '댓글 작성'}
                  </button>
                </div>
              ) : (
                <div className="board-login-note board-comment-login">로그인하면 댓글을 작성할 수 있습니다.</div>
              )}

              <div className="board-comment-list">
                {comments.length === 0 ? <div className="board-empty board-comment-empty">아직 댓글이 없습니다.</div> : null}
                {comments.map((comment) => {
                  const commentId = comment?._normalizedId || normalizeIdValue(comment?._id || comment?.id);
                  const canRemoveComment = mounted && token && userId && (
                    normalizeIdValue(comment?.authorId) === String(userId) ||
                    normalizeIdValue(post?.authorId) === String(userId)
                  );
                  return (
                    <article className="board-comment-item" key={commentId || `${comment.authorName}-${comment.createdAt}`}>
                      <div>
                        {userProfileHref(comment.authorId) ? (
                          <Link href={userProfileHref(comment.authorId)} className="profile-inline-link">
                            <strong>{safeText(comment.authorName, '익명')}</strong>
                          </Link>
                        ) : <strong>{safeText(comment.authorName, '익명')}</strong>}
                        <span>{formatDate(comment.createdAt)}</span>
                      </div>
                      <p>{safeText(comment.content, '')}</p>
                      <div className="board-comment-actions">
                        {mounted && token ? (
                          <button type="button" className="board-secondary board-danger-compact" onClick={() => openReport({ targetType: 'comment', commentId, label: '댓글' })}>
                            신고
                          </button>
                        ) : null}
                        {canRemoveComment ? (
                          <button
                            type="button"
                            className="board-danger board-danger-compact"
                            onClick={() => removeComment(commentId)}
                            disabled={deletingCommentId === commentId}
                          >
                            {deletingCommentId === commentId ? '삭제 중...' : '삭제'}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </article>
        )}
      </section>
    </main>
  );
}
