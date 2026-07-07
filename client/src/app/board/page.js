'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiDelete, apiGetCached, apiPost, clearApiGetCache } from '../../utils/api';
import { useAuthToken, useAuthUser, useHydrated } from '../../utils/client-auth';
import { BoardListToolbar, BoardPostTable, BoardWritePanel } from './_components/BoardListPanels';
import {
  BOARD_CATEGORIES,
  BOARD_PAGE_SIZE,
  BOARD_SORTS,
  getGameOptions,
  getUserId,
  normalizeGameSlug,
  normalizeIdValue,
  normalizePagination,
  safeText,
  unwrapPostList,
} from './_lib/boardListUtils';

export default function BoardPage() {
  const gameOptions = useMemo(() => getGameOptions(), []);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'free', gameSlug: '' });
  const [writerOpen, setWriterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(() => normalizePagination(null));

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
      if (gameFilter) params.set('gameSlug', gameFilter);
      if (sortOrder && sortOrder !== 'latest') params.set('sort', sortOrder);
      if (page > 1) params.set('page', String(page));
      params.set('limit', String(BOARD_PAGE_SIZE));
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await apiGetCached(`/posts${suffix}`, {
        ttlMs: 10000,
        timeoutMs: 12000,
        storage: 'session',
      });
      const nextPosts = unwrapPostList(data);
      const nextPagination = normalizePagination(data?.pagination, nextPosts.length, page);
      setPosts(nextPosts);
      setPagination(nextPagination);
      if (nextPagination.page !== page) setPage(nextPagination.page);
    } catch (err) {
      const nextMessage = err?.response?.data?.error || err.message || '게시글을 불러오지 못했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'danger', message: nextMessage });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, gameFilter, page, query, showToast, sortOrder]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let canceled = false;

    Promise.resolve().then(() => {
      if (canceled) return;
      const params = new URLSearchParams(window.location.search);
      const nextQuery = safeText(params.get('q'), '');
      const nextCategory = safeText(params.get('category'), '');
      const nextGameSlug = normalizeGameSlug(params.get('gameSlug'));
      const nextSort = safeText(params.get('sort'), '');
      const nextPage = Number(params.get('page') || 1);
      const validCategory = BOARD_CATEGORIES.some((item) => item.value === nextCategory);
      if (nextQuery) setQuery(nextQuery);
      if (validCategory) setCategoryFilter(nextCategory);
      if (nextGameSlug) setGameFilter(nextGameSlug);
      if (BOARD_SORTS.some((item) => item.value === nextSort)) setSortOrder(nextSort);
      if (Number.isFinite(nextPage) && nextPage > 1) setPage(Math.floor(nextPage));
      if (params.get('write') === '1') {
        setForm((current) => ({
          ...current,
          category: validCategory ? nextCategory : nextGameSlug ? 'game' : current.category || 'free',
          gameSlug: nextGameSlug || current.gameSlug,
        }));
        setWriterOpen(true);
      }
    });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!mounted || token) return;
    let canceled = false;
    Promise.resolve().then(() => {
      if (!canceled) setWriterOpen(false);
    });
    return () => {
      canceled = true;
    };
  }, [mounted, token]);

  const toggleWriter = () => {
    setWriterOpen((value) => {
      const nextOpen = !value;
      if (nextOpen) {
        setForm((current) => ({
          ...current,
          category: categoryFilter || (gameFilter ? 'game' : current.category || 'free'),
          gameSlug: gameFilter || current.gameSlug,
        }));
      }
      return nextOpen;
    });
  };

  const create = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    const category = form.category || 'free';
    const gameSlug = normalizeGameSlug(form.gameSlug);
    if (!title || !content) {
      const nextMessage = '제목과 내용을 입력해주세요.';
      setMessage(nextMessage);
      showToast({ tone: 'warning', message: nextMessage });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost('/posts', { title, content, category, gameSlug });
      const nextMessage = res?.message || '게시글을 작성했습니다.';
      setMessage(nextMessage);
      showToast({ tone: 'success', message: nextMessage });
      clearApiGetCache('/posts');
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/guides');
      clearApiGetCache('/public/search');
      setForm({ title: '', content: '', category: 'free', gameSlug: '' });
      setWriterOpen(false);
      if (page !== 1) setPage(1);
      else await load();
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
      clearApiGetCache('/posts');
      clearApiGetCache('/public/home-hub');
      clearApiGetCache('/public/guides');
      clearApiGetCache('/public/search');
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
                onClick={toggleWriter}
                aria-expanded={writerOpen}
                aria-controls="board-write-panel"
              >
                {writerOpen ? '닫기' : '글쓰기'}
              </button>
            ) : null}
            <Link href="/eternalhunger" className="board-link-button">
              게임 시작
            </Link>
          </div>
        </div>

        {message ? <div className="board-message">{message}</div> : null}

        <BoardListToolbar
          categoryFilter={categoryFilter}
          filteredCount={filteredPosts.length}
          gameFilter={gameFilter}
          gameOptions={gameOptions}
          mounted={mounted}
          myPostCount={myPostCount}
          pagination={pagination}
          query={query}
          setCategoryFilter={setCategoryFilter}
          setGameFilter={setGameFilter}
          setPage={setPage}
          setQuery={setQuery}
          setSortOrder={setSortOrder}
          sortOrder={sortOrder}
          token={token}
        />

        <BoardWritePanel
          create={create}
          form={form}
          gameOptions={gameOptions}
          mounted={mounted}
          setForm={setForm}
          submitting={submitting}
          token={token}
          user={user}
          writerOpen={writerOpen}
        />

        <BoardPostTable
          filteredPosts={filteredPosts}
          gameOptions={gameOptions}
          loading={loading}
          mounted={mounted}
          pagination={pagination}
          posts={posts}
          remove={remove}
          setPage={setPage}
          token={token}
          userId={userId}
        />
      </section>
    </main>
  );
}
