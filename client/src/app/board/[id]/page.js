'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiDelete, apiGet, apiPut, getToken, getUser } from '../../../utils/api';

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [post, setPost] = useState(null);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  // Hydration mismatch 방지: localStorage는 마운트 이후에만 읽습니다.
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const load = async () => {
    try {
      const data = await apiGet(`/posts/${id}`);
      setPost(data);
      setForm({ title: data?.title || '', content: data?.content || '' });
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    setMounted(true);
    setToken(getToken());
    setUser(getUser());
    if (id) load();
  }, [id]);

  const canEdit = mounted && token && user?._id && post && (String(post.authorId) === String(user._id));

  const save = async () => {
    try {
      const res = await apiPut(`/posts/${id}`, { title: form.title, content: form.content });
      setMessage(res?.message || '수정 완료');
      setEditing(false);
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const remove = async () => {
    if (!confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/posts/${id}`);
      setMessage(res?.message || '삭제 완료');
      router.push('/board');
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <Link href="/board" style={{ color: 'rgba(232,236,255,0.72)', textDecoration: 'none' }}>
        ← 목록
      </Link>

      <h1 style={{ marginTop: 10 }}>게시글</h1>

      {message ? (
        <div style={{ background: '#111827', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {message}
        </div>
      ) : null}

      {!post ? (
        <div style={{ color: 'rgba(232,236,255,0.72)' }}>로딩...</div>
      ) : (
        <div style={{ background: '#0b0e14', border: '1px solid rgba(255,255,255,0.12)', padding: 14, borderRadius: 14 }}>
          <div style={{ color: 'rgba(232,236,255,0.72)', marginBottom: 10 }}>
            {new Date(post.createdAt).toLocaleString()}
          </div>

          {editing ? (
            <>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0f172a', color: '#e5e7eb' }}
              />
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={10}
                style={{ width: '100%', marginTop: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0f172a', color: '#e5e7eb' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={save} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#5b21b6', color: 'white', fontWeight: 800 }}>
                  저장
                </button>
                <button onClick={() => setEditing(false)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#111827', color: 'white', fontWeight: 800 }}>
                  취소
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{post.title}</div>
              <div style={{ color: 'rgba(232,236,255,0.72)', marginTop: 12, whiteSpace: 'pre-wrap' }}>{post.content}</div>
            </>
          )}

          {canEdit ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {!editing ? (
                <button onClick={() => setEditing(true)} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#111827', color: 'white', fontWeight: 800 }}>
                  수정
                </button>
              ) : null}
              <button onClick={remove} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#7f1d1d', color: 'white', fontWeight: 800 }}>
                삭제
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
