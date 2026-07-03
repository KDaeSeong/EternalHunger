'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SiteHeader from '../../../components/SiteHeader';
import { useToast } from '../../../components/ToastProvider';
import { apiDelete, apiGet, apiPut } from '../../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../../utils/client-auth';

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
  if (value?._id) return normalizeIdValue(value._id);
  if (value?.id) return normalizeIdValue(value.id);
  if (typeof value?.toString === 'function') return value.toString();
  return '';
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

function normalizePost(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const authorId = row.authorId || row.userId || row.author?._id || row.author?.id || row.user?._id || row.user?.id || '';
  return {
    ...row,
    title: safeText(row.title, '제목 없음'),
    content: safeText(row.content, ''),
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
  const [form, setForm] = useState({ title: '', content: '' });

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
      const data = await apiGet(`/posts/${id}`);
      const nextPost = unwrapPost(data);
      setPost(nextPost);
      setForm({ title: safeText(nextPost?.title, ''), content: safeText(nextPost?.content, '') });
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
      const res = await apiPut(`/posts/${id}`, { title, content });
      const nextMessage = res?.message || '수정했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
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
      router.push('/board');
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글 삭제에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
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
                  <div className="board-post-kicker">자유</div>
                  <h2>{safeText(post.title, '제목 없음')}</h2>
                </div>
                <dl className="board-post-meta">
                  <div>
                    <dt>작성자</dt>
                    <dd>{safeText(post.authorName, '익명')}</dd>
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
          </article>
        )}
      </section>
    </main>
  );
}
