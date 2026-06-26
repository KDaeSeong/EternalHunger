'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function BoardPage() {
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  const mounted = useHydrated();
  const token = useAuthToken();
  const user = useAuthUser();
  const userId = useMemo(() => getUserId(user), [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/posts');
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || '게시글을 불러오지 못했습니다.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      setMessage('제목과 내용을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost('/posts', { title, content });
      setMessage(res?.message || '작성 완료');
      setForm({ title: '', content: '' });
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || '게시글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    if (!id || !window.confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/posts/${id}`);
      setMessage(res?.message || '삭제 완료');
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || '게시글 삭제에 실패했습니다.');
    }
  };

  return (
    <main className="board-page">
      <section className="board-shell">
        <div className="board-head">
          <div>
            <p className="board-eyebrow">Eternal Hunger</p>
            <h1>게시판</h1>
          </div>
          <Link href="/" className="board-link-button">
            메인으로
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
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="제목"
              maxLength={120}
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
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
            const id = post?._id || post?.id;
            const content = String(post?.content || '');
            const canRemove = mounted && token && userId && String(post?.authorId || '') === String(userId);
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
