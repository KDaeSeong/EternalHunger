'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SiteHeader from '../../../components/SiteHeader';
import BoardCommentsSection from '../_components/BoardCommentsSection';
import BoardDetailPostView from '../_components/BoardDetailPostView';
import BoardReportPanel from '../_components/BoardReportPanel';
import { useToast } from '../../../components/ToastProvider';
import { apiDelete, apiGet, apiGetCached, apiPost, apiPut, clearApiGetCache } from '../../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../../utils/client-auth';
import {
  gameLabelForSlug,
  getGameOptions,
  getUserId,
  normalizeGameSlug,
  normalizeIdValue,
  normalizeRouteId,
  safeText,
  unwrapPost,
} from '../_lib/boardUtils';

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = normalizeRouteId(params?.id);
  const gameOptions = useMemo(() => getGameOptions(), []);

  const [post, setPost] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'free', gameSlug: '' });
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState({ id: '', content: '' });
  const [editingCommentSaving, setEditingCommentSaving] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState('');
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportForm, setReportForm] = useState({ reason: 'other', detail: '' });
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);
  const [reacted, setReacted] = useState(false);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [reactionSaving, setReactionSaving] = useState(false);

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
      setForm({ title: safeText(nextPost?.title, ''), content: safeText(nextPost?.content, ''), category: safeText(nextPost?.category, 'free'), gameSlug: normalizeGameSlug(nextPost?.gameSlug) });
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id, setForm, setLoading, setMessage, setPost, showToast]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const loadBookmarkStatus = useCallback(async () => {
    if (!id || !token) {
      setBookmarked(false);
      return;
    }

    setBookmarkLoading(true);
    try {
      const data = await apiGet(`/posts/${id}/bookmark`, { timeoutMs: 10000 });
      setBookmarked(Boolean(data?.bookmarked));
    } catch {
      setBookmarked(false);
    } finally {
      setBookmarkLoading(false);
    }
  }, [id, setBookmarked, setBookmarkLoading, token]);

  useEffect(() => {
    if (!mounted) return;
    void Promise.resolve().then(loadBookmarkStatus);
  }, [loadBookmarkStatus, mounted]);

  const loadReactionStatus = useCallback(async () => {
    if (!id || !token) {
      setReacted(false);
      return;
    }

    setReactionLoading(true);
    try {
      const data = await apiGet(`/posts/${id}/reaction`, { timeoutMs: 10000 });
      setReacted(Boolean(data?.reacted));
      if (Number.isFinite(Number(data?.reactionCount))) {
        setPost((current) => current ? { ...current, reactionCount: Number(data.reactionCount) } : current);
      }
    } catch {
      setReacted(false);
    } finally {
      setReactionLoading(false);
    }
  }, [id, setPost, setReacted, setReactionLoading, token]);

  useEffect(() => {
    if (!mounted) return;
    void Promise.resolve().then(loadReactionStatus);
  }, [loadReactionStatus, mounted]);

  const canEdit = mounted && token && userId && post && normalizeIdValue(post.authorId) === String(userId);
  const canManageNotice = mounted && token && Boolean(user?.isAdmin) && post;
  const comments = Array.isArray(post?.comments) ? post.comments : [];
  const postGameLabel = gameLabelForSlug(gameOptions, post?.gameSlug);

  const applyPostResponse = (data) => {
    const nextPost = unwrapPost(data);
    if (!nextPost) return;
    setPost(nextPost);
    setForm({ title: safeText(nextPost?.title, ''), content: safeText(nextPost?.content, ''), category: safeText(nextPost?.category, 'free'), gameSlug: normalizeGameSlug(nextPost?.gameSlug) });
  };

  const clearPostCaches = () => {
    clearApiGetCache(`/posts/${id}`);
    clearApiGetCache('/posts/bookmarks');
    clearApiGetCache('/posts');
    clearApiGetCache('/public/home-hub');
    clearApiGetCache('/public/guides');
    clearApiGetCache('/public/search');
  };

  const toggleBookmark = async () => {
    if (!id || bookmarkSaving) return;
    setBookmarkSaving(true);
    try {
      const res = await apiPost(`/posts/${id}/bookmark`, {}, { timeoutMs: 10000 });
      setBookmarked(Boolean(res?.bookmarked));
      clearPostCaches();
      showToast({
        tone: res?.bookmarked ? 'success' : 'warning',
        message: res?.message || (res?.bookmarked ? '게시글을 저장했습니다.' : '저장한 글에서 해제했습니다.'),
      });
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '게시글 저장 상태 변경에 실패했습니다.' });
    } finally {
      setBookmarkSaving(false);
    }
  };

  const toggleReaction = async () => {
    if (!id || reactionSaving) return;
    setReactionSaving(true);
    try {
      const res = await apiPost(`/posts/${id}/reaction`, {}, { timeoutMs: 10000 });
      setReacted(Boolean(res?.reacted));
      if (Number.isFinite(Number(res?.reactionCount))) {
        setPost((current) => current ? { ...current, reactionCount: Number(res.reactionCount) } : current);
      }
      clearPostCaches();
      showToast({
        tone: res?.reacted ? 'success' : 'warning',
        message: res?.message || (res?.reacted ? '게시글을 추천했습니다.' : '게시글 추천을 취소했습니다.'),
      });
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '게시글 추천 상태 변경에 실패했습니다.' });
    } finally {
      setReactionSaving(false);
    }
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
      const res = await apiPut(`/posts/${id}`, { title, content, category: form.category || 'free', gameSlug: normalizeGameSlug(form.gameSlug) });
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

  const startEditComment = (comment) => {
    const commentId = comment?._normalizedId || normalizeIdValue(comment?._id || comment?.id);
    setEditingComment({ id: commentId, content: safeText(comment?.content, '') });
  };

  const cancelEditComment = () => {
    setEditingComment({ id: '', content: '' });
  };

  const updateComment = async () => {
    const commentId = editingComment.id;
    const content = editingComment.content.trim();
    if (!commentId || !content) {
      const nextMessage = '댓글 내용을 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setEditingCommentSaving(true);
    try {
      const res = await apiPut(`/posts/${id}/comments/${commentId}`, { content });
      applyPostResponse(res);
      cancelEditComment();
      const nextMessage = res?.message || '댓글을 수정했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      clearPostCaches();
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '댓글 수정에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setEditingCommentSaving(false);
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
            <BoardDetailPostView
              bookmarked={bookmarked}
              bookmarkLoading={bookmarkLoading}
              bookmarkSaving={bookmarkSaving}
              canEdit={canEdit}
              canManageNotice={canManageNotice}
              comments={comments}
              editing={editing}
              form={form}
              gameOptions={gameOptions}
              mounted={mounted}
              noticeSaving={noticeSaving}
              openReport={openReport}
              post={post}
              postGameLabel={postGameLabel}
              reacted={reacted}
              reactionLoading={reactionLoading}
              reactionSaving={reactionSaving}
              remove={remove}
              save={save}
              saving={saving}
              setEditing={setEditing}
              setForm={setForm}
              token={token}
              toggleBookmark={toggleBookmark}
              toggleNotice={toggleNotice}
              toggleReaction={toggleReaction}
            />

            <BoardReportPanel
              comments={comments}
              reportForm={reportForm}
              reportSubmitting={reportSubmitting}
              reportTarget={reportTarget}
              setReportForm={setReportForm}
              setReportTarget={setReportTarget}
              submitReport={submitReport}
            />

            <BoardCommentsSection
              cancelEditComment={cancelEditComment}
              commentSubmitting={commentSubmitting}
              commentText={commentText}
              comments={comments}
              createComment={createComment}
              deletingCommentId={deletingCommentId}
              editingComment={editingComment}
              editingCommentSaving={editingCommentSaving}
              form={form}
              mounted={mounted}
              openReport={openReport}
              post={post}
              removeComment={removeComment}
              setEditingComment={setEditingComment}
              setCommentText={setCommentText}
              startEditComment={startEditComment}
              token={token}
              updateComment={updateComment}
              userId={userId}
            />
          </article>
        )}
      </section>
    </main>
  );
}
