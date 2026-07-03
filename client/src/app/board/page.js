'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiDelete, apiGet, apiPost } from '../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../utils/client-auth';

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
    _normalizedId: normalizePostId(row),
    title: safeText(row.title, '제목 없음'),
    content: safeText(row.content ?? row.contentPreview, ''),
    contentPreview: safeText(row.contentPreview ?? row.content, ''),
    commentCount: Number(row.commentCount || 0),
    isNotice: Boolean(row.isNotice),
    noticePinnedAt: row.noticePinnedAt || '',
    category: safeText(row.category, 'free'),
    categoryLabel: safeText(row.categoryLabel, '자유'),
    createdAt: row.createdAt || row.created_at || row.date || '',
    authorId,
    authorName: safeText(row.author?.nickname || row.user?.nickname || authorId?.nickname || row.authorName || row.username || row.author?.username || row.user?.username || authorId?.username, '익명'),
  };
}

function unwrapPostList(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.posts)
      ? data.posts
      : Array.isArray(data?.data)
        ? data.data
        : [];
  return list.map(normalizePost).filter(Boolean);
}

function getUserDisplayName(user) {
  return safeText(user?.nickname, '') || safeText(user?.username, '사용자');
}

export default function BoardPage() {
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'free' });
  const [writerOpen, setWriterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const mounted = useHydrated();
  const token = useAuthToken();
  const user = useAuthUser();
  const { showToast } = useToast();
  const userId = useMemo(() => getUserId(user), [user]);
  const filteredPosts = posts;
  const myPostCount = useMemo(() => {
    if (!mounted || !userId) return 0;
    return posts.filter((post) => normalizeIdValue(post?.authorId) === String(userId)).length;
  }, [mounted, posts, userId]);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (categoryFilter) params.set('category', categoryFilter);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await apiGet(`/posts${suffix}`);
      setPosts(unwrapPostList(data));
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, query, showToast]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (!mounted || token) return;
    setWriterOpen(false);
  }, [mounted, token]);

  const create = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    const category = form.category || 'free';
    if (!title || !content) {
      const nextMessage = '제목과 내용을 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost('/posts', { title, content, category });
      const nextMessage = res?.message || '게시글을 작성했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      setForm({ title: '', content: '', category: 'free' });
      setWriterOpen(false);
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
          <div className="board-head-actions">
            {mounted && token ? (
              <button
                type="button"
                className="board-link-button"
                onClick={() => setWriterOpen((value) => !value)}
                aria-expanded={writerOpen}
                aria-controls="board-write-panel"
              >
                {writerOpen ? '닫기' : '글쓰기'}
              </button>
            ) : null}
            <Link href="/simulation" className="board-link-button">
              게임 시작
            </Link>
          </div>
        </div>

        {message ? <div className="board-message">{message}</div> : null}

        <div className="board-toolbar">
          <div className="board-counts">
            <span>전체 {posts.length}</span>
            <span>검색 {filteredPosts.length}</span>
            {mounted && token ? <span>내 글 {myPostCount}</span> : null}
          </div>
          <label className="board-search">
            <span>검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 내용, 작성자"
            />
          </label>
          <label className="board-search board-category-filter">
            <span>분류</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">전체</option>
              {BOARD_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </label>
        </div>

        {mounted && token && writerOpen ? (
          <div className="board-write-panel" id="board-write-panel">
            <div className="board-editor-title">
              글쓰기 {user ? <span>작성자: {getUserDisplayName(user)}</span> : null}
            </div>
            <div className="board-write-grid">
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
              <button type="button" onClick={create} disabled={submitting}>
                {submitting ? '작성 중...' : '등록'}
              </button>
            </div>
            <textarea
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              placeholder="내용"
              rows={4}
            />
          </div>
        ) : (
          <div className="board-login-note">로그인하면 글을 작성할 수 있습니다.</div>
        )}

        <div className="board-table-wrap">
          {loading ? <div className="board-empty">게시글을 불러오는 중입니다.</div> : null}

          {!loading && posts.length === 0 ? (
            <div className="board-empty">아직 작성된 글이 없습니다.</div>
          ) : null}

          {!loading && posts.length > 0 && filteredPosts.length === 0 ? (
            <div className="board-empty">검색 결과가 없습니다.</div>
          ) : null}

          {!loading && filteredPosts.length > 0 ? (
            <table className="board-table">
              <colgroup>
                <col className="board-col-no" />
                <col className="board-col-title" />
                <col className="board-col-author" />
                <col className="board-col-date" />
                <col className="board-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th>번호</th>
                  <th>제목</th>
                  <th>작성자</th>
                  <th>등록일</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post, index) => {
                  const id = post?._normalizedId || normalizePostId(post);
                  const title = safeText(post?.title, '제목 없음');
                  const preview = safeText(post?.contentPreview || post?.content, '');
                  const canRemove = mounted && token && userId && normalizeIdValue(post?.authorId) === String(userId);
                  const rowNo = filteredPosts.length - index;
                  return (
                    <tr key={id || `${post?.title}-${post?.createdAt}`}>
                      <td className="board-cell-no" data-label="번호">{rowNo}</td>
                      <td className="board-cell-title" data-label="제목">
                        <Link href={id ? `/board/${id}` : '/board'} className={`board-row-title ${post?.isNotice ? 'is-notice' : ''}`}>
                          <span>{title}</span>
                          <small>{preview ? `${preview}${preview.length >= 160 ? '...' : ''}` : '미리보기 없음'}</small>
                          <em>{post?.isNotice ? '공지 · ' : ''}댓글 {Number(post?.commentCount || 0)}</em>
                        </Link>
                      </td>
                      <td data-label="작성자">{safeText(post?.authorName, '익명')}</td>
                      <td data-label="등록일">{formatDate(post?.createdAt)}</td>
                      <td className="board-cell-action" data-label="관리">
                        {canRemove ? (
                          <button type="button" className="board-danger board-danger-compact" onClick={() => remove(id)}>
                            삭제
                          </button>
                        ) : (
                          <span className="board-action-dash">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
    </main>
  );
}
