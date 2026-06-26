'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [post, setPost] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  const mounted = useHydrated();
  const token = useAuthToken();
  const user = useAuthUser();
  const userId = useMemo(() => getUserId(user), [user]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiGet(`/posts/${id}`);
      setPost(data || null);
      setForm({ title: data?.title || '', content: data?.content || '' });
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || '게시글을 불러오지 못했습니다.');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = mounted && token && userId && post && String(post.authorId || '') === String(userId);

  const save = async () => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      setMessage('제목과 내용을 입력해 주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiPut(`/posts/${id}`, { title, content });
      setMessage(res?.message || '수정 완료');
      setEditing(false);
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || '게시글 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/posts/${id}`);
      setMessage(res?.message || '삭제 완료');
      router.push('/board');
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
          <article className="board-card board-detail-card">
            <div className="board-card-meta">{formatDate(post.createdAt)}</div>

            {editing ? (
              <div className="board-editor board-editor-inline">
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
                <h2>{post.title || '제목 없음'}</h2>
                <p className="board-detail-content">{post.content || ''}</p>
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
