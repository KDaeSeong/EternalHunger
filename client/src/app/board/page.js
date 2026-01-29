'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, getToken, getUser } from '../../utils/api';

export default function BoardPage() {
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', content: '' });
  // NOTE: localStorage 기반 토큰/유저 정보는 SSR 시점에는 없기 때문에
  // 렌더 타이밍에 바로 읽으면 서버/클라이언트 렌더 결과가 달라져
  // Hydration mismatch가 발생할 수 있습니다.
  // -> 마운트 후(useEffect) 읽어서 상태로 반영합니다.
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const load = async () => {
    try {
      const data = await apiGet('/posts');
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    setMounted(true);
    setToken(getToken());
    setUser(getUser());
    load();
  }, []);

  const create = async () => {
    try {
      const res = await apiPost('/posts', { title: form.title, content: form.content });
      setMessage(res?.message || '작성 완료');
      setForm({ title: '', content: '' });
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/posts/${id}`);
      setMessage(res?.message || '삭제 완료');
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ marginTop: 0 }}>게시판</h1>

      {message ? (
        <div style={{ background: '#111827', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)', padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {message}
        </div>
      ) : null}

      {mounted && token ? (
        <div style={{ background: '#0b0e14', border: '1px solid rgba(255,255,255,0.12)', padding: 14, borderRadius: 14, marginBottom: 18 }}>
          <div style={{ color: 'rgba(232,236,255,0.72)', marginBottom: 10 }}>글쓰기 {user?.username ? `(작성자: ${user.username})` : ''}</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="제목"
              style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0f172a', color: '#e5e7eb' }}
            />
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="내용"
              rows={4}
              style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0f172a', color: '#e5e7eb' }}
            />
            <button
              onClick={create}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#5b21b6', color: 'white', fontWeight: 800 }}
            >
              작성
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: 'rgba(232,236,255,0.72)', marginBottom: 18 }}>
          로그인하면 글을 작성할 수 있습니다.
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {posts.map((p) => (
          <div key={p._id} style={{ background: '#0b0e14', border: '1px solid rgba(255,255,255,0.12)', padding: 14, borderRadius: 14 }}>
            <Link href={`/board/${p._id}`} style={{ color: '#e8ecff', fontWeight: 800, textDecoration: 'none' }}>
              {p.title}
            </Link>
            <div style={{ color: 'rgba(232,236,255,0.72)', marginTop: 6 }}>
              {new Date(p.createdAt).toLocaleString()}
            </div>
            <div style={{ color: 'rgba(232,236,255,0.72)', marginTop: 10, whiteSpace: 'pre-wrap' }}>
              {(p.content || '').slice(0, 180)}{(p.content || '').length > 180 ? '…' : ''}
            </div>

            {mounted && token && user?._id && (String(p.authorId) === String(user._id)) ? (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => remove(p._id)}
                  style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#7f1d1d', color: 'white', fontWeight: 800 }}
                >
                  삭제
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {posts.length === 0 ? (
          <div style={{ color: 'rgba(232,236,255,0.72)' }}>글이 없습니다.</div>
        ) : null}
      </div>
    </div>
  );
}
