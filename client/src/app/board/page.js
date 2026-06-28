'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiDelete, apiGet, apiPost } from '../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../utils/client-auth';

function formatDate(value) {
  if (!value) return '날짜 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 없음';
  return date.toLocaleString('ko-KR');
}

function getUserId(user) {
  return user?._id || user?.id || user?.userId || '';
}

function normalizePostId(post) {
  const id = post?._id || post?.id;
  if (!id) return '';
  if (typeof id === 'string' || typeof id === 'number') return String(id);
  if (id?.$oid) return String(id.$oid);
  if (typeof id?.toString === 'function') return id.toString();
  return '';
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

function unwrapPostList(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.posts)
      ? data.posts
      : Array.isArray(data?.data)
        ? data.data
        : [];
  return list.filter((row) => row && typeof row === 'object');
}

export default function BoardPage() {
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  const mounted = useHydrated();
  const token = useAuthToken();
  const user = useAuthUser();
  const { showToast } = useToast();
  const userId = useMemo(() => getUserId(user), [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/posts');
      setPosts(unwrapPostList(data));
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      const nextMessage = '제목과 내용을 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost('/posts', { title, content });
      const nextMessage = res?.message || '게시글을 작성했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      setForm({ title: '', content: '' });
      await load();
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글 작성에 실패했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    if (!id || !window.confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/posts/${id}`);
      const nextMessage = res?.message || '삭제했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      await load();
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
            <h1>게시판</h1>
          </div>
          <Link href="/simulation" className="board-link-button">
            게임 시작
          </Link>
        </div>

        {message ? <div className="board-message">{message}</div> : null}

        {mounted && token ? (
          <div className="board-editor">
            <div className="board-editor-title">
              글쓰기 {user?.username ? <span>작성자: {user.username}</span> : null}
            </div>
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
              rows={4}
            />
            <button type="button" onClick={create} disabled={submitting}>
              {submitting ? '작성 중...' : '작성'}
            </button>
          </div>
        ) : (
          <div className="board-login-note">로그인하면 글을 작성할 수 있습니다.</div>
        )}

        <div className="board-list">
          {loading ? <div className="board-empty">게시글을 불러오는 중입니다.</div> : null}

          {!loading && posts.length === 0 ? (
            <div className="board-empty">아직 작성된 글이 없습니다.</div>
          ) : null}

          {!loading && posts.map((post) => {
            const id = normalizePostId(post);
            const content = String(post?.content || '');
            const canRemove = mounted && token && userId && normalizeIdValue(post?.authorId) === String(userId);
            return (
              <article key={id || `${post?.title}-${post?.createdAt}`} className="board-card">
                <Link href={id ? `/board/${id}` : '/board'} className="board-card-title">
                  {post?.title || '제목 없음'}
                </Link>
                <div className="board-card-meta">{formatDate(post?.createdAt)}</div>
                <p>{content.slice(0, 180)}{content.length > 180 ? '...' : ''}</p>
                {canRemove ? (
                  <button type="button" className="board-danger" onClick={() => remove(id)}>
                    삭제
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
