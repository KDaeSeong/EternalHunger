'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useToast } from '../../components/ToastProvider';
import { apiGetCached, apiPost, clearApiGetCache } from '../../utils/api';
import { useAuthToken, useHydrated } from '../../utils/client-auth';

function safeText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizePost(row) {
  if (!row || typeof row !== 'object') return null;
  const id = safeText(row._id || row.id, '');
  if (!id) return null;
  return {
    ...row,
    _id: id,
    title: safeText(row.title, '제목 없음'),
    authorName: safeText(row.authorName || row.author?.nickname || row.author?.username, '익명'),
    categoryLabel: safeText(row.categoryLabel, '자유'),
    contentPreview: safeText(row.contentPreview, ''),
    commentCount: Number(row.commentCount || 0),
    reactionCount: Number(row.reactionCount || 0),
    savedAt: row.savedAt || row.createdAt || '',
    createdAt: row.createdAt || '',
  };
}

function unwrapPosts(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.posts)
      ? payload.posts
      : [];
  return list.map(normalizePost).filter(Boolean);
}

export default function BookmarksPage() {
  const hydrated = useHydrated();
  const token = useAuthToken();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');

  const loadBookmarks = useCallback(async (options = {}) => {
    if (!token) {
      setPosts([]);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await apiGetCached('/posts/bookmarks', {
        ttlMs: 15000,
        timeoutMs: 15000,
        storage: 'session',
        force: Boolean(options.force),
      });
      setPosts(unwrapPosts(data));
    } catch (err) {
      const message = err?.message || '저장한 글을 불러오지 못했습니다.';
      setError(message);
      setPosts([]);
      showToast({ tone: 'danger', message });
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  useEffect(() => {
    if (!hydrated) return;
    void loadBookmarks();
  }, [hydrated, loadBookmarks]);

  const clearBookmarkCaches = (postId = '') => {
    clearApiGetCache('/posts/bookmarks');
    if (postId) clearApiGetCache(`/posts/${postId}`);
    clearApiGetCache('/posts');
    clearApiGetCache('/public/home-hub');
    clearApiGetCache('/public/guides');
    clearApiGetCache('/public/search');
  };

  const removeBookmark = async (postId) => {
    if (!postId || removingId) return;
    setRemovingId(postId);
    try {
      const res = await apiPost(`/posts/${postId}/bookmark`, {}, { timeoutMs: 10000 });
      setPosts((current) => current.filter((post) => post._id !== postId));
      clearBookmarkCaches(postId);
      showToast({ tone: 'success', message: res?.message || '저장한 글에서 해제했습니다.' });
    } catch (err) {
      showToast({ tone: 'danger', message: err?.message || '저장 해제에 실패했습니다.' });
    } finally {
      setRemovingId('');
    }
  };

  const commentTotal = useMemo(
    () => posts.reduce((sum, post) => sum + Number(post.commentCount || 0), 0),
    [posts]
  );

  return (
    <main className="bookmarks-page-shell">
      <SiteHeader />
      <section className="bookmarks-page">
        <div className="bookmarks-hero">
          <div>
            <p className="bookmarks-kicker">Saved Posts</p>
            <h1>저장글</h1>
            <p>다시 볼 게시글과 공략을 모아둡니다.</p>
          </div>
          <div className="bookmarks-actions">
            <button type="button" onClick={() => void loadBookmarks({ force: true })} disabled={!token || loading}>
              새로고침
            </button>
            <Link href="/board">게시판</Link>
          </div>
        </div>

        {!hydrated ? (
          <div className="bookmarks-empty">로그인 상태를 확인하는 중입니다.</div>
        ) : !token ? (
          <div className="bookmarks-empty">
            <p>로그인하면 게시글을 저장하고 다시 볼 수 있습니다.</p>
            <Link href="/login">로그인</Link>
          </div>
        ) : (
          <>
            <section className="bookmarks-summary" aria-label="저장글 요약">
              <div><span>저장글</span><strong>{posts.length.toLocaleString('ko-KR')}</strong></div>
              <div><span>댓글 합계</span><strong>{commentTotal.toLocaleString('ko-KR')}</strong></div>
              <div><span>최근 저장</span><strong>{formatDate(posts[0]?.savedAt) || '-'}</strong></div>
            </section>

            {loading ? <div className="bookmarks-empty">저장한 글을 불러오는 중입니다.</div> : null}
            {!loading && error ? (
              <div className="bookmarks-empty bookmarks-error">
                <p>{error}</p>
                <button type="button" onClick={() => void loadBookmarks({ force: true })}>다시 불러오기</button>
              </div>
            ) : null}
            {!loading && !error && posts.length === 0 ? (
              <div className="bookmarks-empty">
                <p>아직 저장한 글이 없습니다.</p>
                <Link href="/board">게시판 둘러보기</Link>
              </div>
            ) : null}

            <section className="bookmarks-list" aria-label="저장한 게시글 목록">
              {posts.map((post) => (
                <article className="bookmarks-card" key={post._id}>
                  <div>
                    <span>{post.categoryLabel}</span>
                    <h2><Link href={`/board/${post._id}`}>{post.title}</Link></h2>
                    <p>{post.contentPreview || '미리보기 내용이 없습니다.'}</p>
                    <small>
                      작성자 {post.authorName} · 추천 {post.reactionCount.toLocaleString('ko-KR')} · 댓글 {post.commentCount.toLocaleString('ko-KR')} · 저장 {formatDate(post.savedAt) || '-'}
                    </small>
                  </div>
                  <button type="button" onClick={() => removeBookmark(post._id)} disabled={removingId === post._id}>
                    {removingId === post._id ? '해제 중...' : '저장 해제'}
                  </button>
                </article>
              ))}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
