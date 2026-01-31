'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiDelete, apiGet, apiPost, apiPut } from '../../utils/api';

import '../../styles/ERDetails.css';
import '../../styles/EREvents.css';

export default function EventsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [maps, setMaps] = useState([]);
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');

  const [form, setForm] = useState({
    title: '',
    text: '',
    killers: [],
    victims: [],
    benefits: [],
    time: 'any',
    mapId: '',
    zoneId: '',
    enabled: true,
  });

  const [editingId, setEditingId] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

// 화면이 켜진 뒤에만 localStorage에 접근 (에러 방지)
const userData = localStorage.getItem('user');
if (userData) {
  try {
    setUser(JSON.parse(userData));
  } catch {
    // 파싱 실패 시 무시
  }
}


    fetchEvents();
    fetchMaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

const handleLogout = () => {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  }
};

  const fetchEvents = async () => {
    try {
      const data = await apiGet('/events');
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage(e.message);
      setEvents([]);
    }
  };

  const fetchMaps = async () => {
    try {
      // ✅ 맵은 공개 데이터(로그인/관리자 여부와 무관)
      const data = await apiGet('/public/maps');
      const list = Array.isArray(data) ? data : Array.isArray(data?.maps) ? data.maps : [];
      setMaps(list);
    } catch (e) {
      // 맵이 없어도 이벤트 편집은 가능하게(단, 필터/구역 선택은 비활성)
      setMaps([]);
      setMessage((prev) => prev || e.message);
    }
  };

  const filteredEvents = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((ev) => {
      const s = `${ev.title || ''} ${ev.text || ''}`.toLowerCase();
      return s.includes(needle);
    });
  }, [events, q]);

  const getCurrentMap = () => maps.find((m) => String(m._id) === String(form.mapId));

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addRole = (field) => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const updateRole = (field, idx, value) => {
    setForm((prev) => {
      const arr = [...prev[field]];
      arr[idx] = value;
      return { ...prev, [field]: arr };
    });
  };

  const removeRole = (field, idx) => {
    setForm((prev) => {
      const arr = [...prev[field]];
      arr.splice(idx, 1);
      return { ...prev, [field]: arr };
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      text: '',
      killers: [],
      victims: [],
      benefits: [],
      time: 'any',
      mapId: '',
      zoneId: '',
      enabled: true,
    });
  };

  const handleSubmit = async () => {
    try {
      setMessage('');
      if (!form.title.trim()) throw new Error('제목을 입력하세요.');
      if (!form.text.trim()) throw new Error('내용을 입력하세요.');

      const payload = {
        title: form.title.trim(),
        text: form.text.trim(),
        killers: form.killers.map((s) => String(s).trim()).filter(Boolean),
        victims: form.victims.map((s) => String(s).trim()).filter(Boolean),
        benefits: form.benefits.map((s) => String(s).trim()).filter(Boolean),
        time: form.time || 'any',
        mapId: form.mapId || '',
        zoneId: form.zoneId || '',
        enabled: Boolean(form.enabled),
      };

      if (editingId) {
        await apiPut(`/events/${editingId}`, payload);
        setMessage('수정 완료');
      } else {
        await apiPost('/events/add', payload);
        setMessage('추가 완료');
      }

      resetForm();
      fetchEvents();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const handleEdit = (ev) => {
    setEditingId(ev._id);
    setForm({
      title: ev.title || '',
      text: ev.text || '',
      killers: Array.isArray(ev.killers) ? ev.killers : [],
      victims: Array.isArray(ev.victims) ? ev.victims : [],
      benefits: Array.isArray(ev.benefits) ? ev.benefits : [],
      time: ev.time || 'any',
      mapId: ev.mapId || '',
      zoneId: ev.zoneId || '',
      enabled: ev.enabled !== false,
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('삭제할까요?')) return;
    try {
      await apiDelete(`/events/${id}`);
      setMessage('삭제 완료');
      fetchEvents();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const moveItem = (from, to) => {
    if (from === null || to === null) return;
    setEvents((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const saveReorder = async () => {
    try {
      const orderedIds = events.map((e) => e._id);
      await apiPost('/events/reorder', { orderedIds });
      setMessage('정렬 저장 완료');
      setReorderMode(false);
      setDragIndex(null);
      fetchEvents();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const currentMap = getCurrentMap();
  const zones = Array.isArray(currentMap?.zones) ? currentMap.zones : [];

  return (
    <main>
      <header>
        <section id="header-id1">
          <ul>
            {/* 1. 로고 */}
            <li>
              <Link href="/" className="logo-btn">
                <div className="text-logo">
                  <span className="logo-top">PROJECT</span>
                  <span className="logo-main">ARENA</span>
                </div>
              </Link>
            </li>

            {/* 2. 네비게이션 메뉴 */}
            <li><Link href="/">메인</Link></li>
            <li><Link href="/characters">캐릭터 설정</Link></li>
            <li><Link href="/details">캐릭터 상세설정</Link></li>
            <li><Link id="EREvent" href="/events">이벤트 설정</Link></li>
            <li><Link href="/modifiers">보정치 설정</Link></li>

            {/* 3. 게임 시작 버튼 (강조) */}
            <li><Link href="/simulation" style={{ color: '#0288d1', fontWeight: 'bold' }}>▶ 게임 시작</Link></li>

            {/* 4. 우측 끝 유저 정보 */}
            <li className="auth-menu">
              {user ? (
                <div className="user-info">
                  <span>👤 <strong>{user.username}</strong>님 (LP: {user.lp})</span>
                  <button className="logout-btn" onClick={handleLogout}>🚪 로그아웃</button>
                </div>
              ) : (
                <div className="auth-btns">
                  <Link href="/login" className="login-btn">🔑 로그인</Link>
                  <Link href="/signup" className="signup-btn">📝 회원가입</Link>
                </div>
              )}
            </li>
          </ul>
        </section>
      </header>

      <div className="page-header">
        <h1>이벤트 설정</h1>
        <p>이벤트를 추가/수정하고 조건(시간/맵/구역)을 설정해보세요.</p>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 12px' }}>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="검색(제목/내용)"
          style={{
            flex: 1,
            minWidth: 220,
            padding: 10,
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.12)',
          }}
        />
        <button
          onClick={() => setReorderMode((v) => !v)}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.12)',
            background: reorderMode ? '#111827' : '#fff',
            color: reorderMode ? '#fff' : '#111827',
            cursor: 'pointer',
          }}
        >
          {reorderMode ? '정렬 모드 종료' : '정렬 모드'}
        </button>
        {reorderMode && (
          <button
            onClick={saveReorder}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              background: '#4f46e5',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            정렬 저장
          </button>
        )}
      </div>

      {message && (
        <div
          style={{
            background: 'rgba(255, 235, 235, 0.9)',
            border: '1px solid rgba(255,0,0,0.2)',
            padding: 10,
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          {message}
        </div>
      )}

      {/* 폼 */}
      <div
        style={{
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <input
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="제목"
            style={{
              flex: 1,
              minWidth: 260,
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
            }}
          />

          <select
            value={form.time}
            onChange={(e) => handleChange('time', e.target.value)}
            style={{
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              minWidth: 140,
            }}
          >
            <option value="any">시간 무관</option>
            <option value="day">낮</option>
            <option value="night">밤</option>
          </select>

          <select
            value={form.mapId}
            onChange={(e) => {
              handleChange('mapId', e.target.value);
              handleChange('zoneId', '');
            }}
            style={{
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              minWidth: 180,
            }}
          >
            <option value="">맵 무관</option>
            {maps.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={form.zoneId}
            onChange={(e) => handleChange('zoneId', e.target.value)}
            disabled={!form.mapId || zones.length === 0}
            style={{
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              minWidth: 180,
              opacity: !form.mapId || zones.length === 0 ? 0.6 : 1,
            }}
          >
            <option value="">구역 무관</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px' }}>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
            />
            사용
          </label>
        </div>

        <textarea
          value={form.text}
          onChange={(e) => handleChange('text', e.target.value)}
          placeholder="내용"
          rows={3}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.12)',
            marginBottom: 10,
          }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>살인자</div>
            {form.killers.map((v, idx) => (
              <div key={`k-${idx}`} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={v}
                  onChange={(e) => updateRole('killers', idx, e.target.value)}
                  placeholder="캐릭터 이름"
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
                />
                <button
                  onClick={() => removeRole('killers', idx)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              onClick={() => addRole('killers')}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.12)',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              + 살인자 추가
            </button>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>피해자</div>
            {form.victims.map((v, idx) => (
              <div key={`v-${idx}`} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={v}
                  onChange={(e) => updateRole('victims', idx, e.target.value)}
                  placeholder="캐릭터 이름"
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
                />
                <button
                  onClick={() => removeRole('victims', idx)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              onClick={() => addRole('victims')}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.12)',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              + 피해자 추가
            </button>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>이로운 효과 대상자</div>
            {form.benefits.map((v, idx) => (
              <div key={`b-${idx}`} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={v}
                  onChange={(e) => updateRole('benefits', idx, e.target.value)}
                  placeholder="캐릭터 이름"
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
                />
                <button
                  onClick={() => removeRole('benefits', idx)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.12)',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
            <button
              onClick={() => addRole('benefits')}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.12)',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              + 대상자 추가
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            onClick={handleSubmit}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              background: '#4f46e5',
              color: '#fff',
              cursor: 'pointer',
              minWidth: 120,
            }}
          >
            {editingId ? '수정 저장' : '추가'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.12)',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          )}
        </div>
      </div>

      {/* 목록 */}
      <div
        style={{
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 14,
          padding: 14,
        }}
      >
        <h2 style={{ margin: '0 0 10px 0', fontSize: 18 }}>이벤트 목록</h2>

        {filteredEvents.length === 0 ? (
          <div style={{ color: 'rgba(0,0,0,0.6)' }}>이벤트가 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filteredEvents.map((ev, idx) => (
              <div
                key={ev._id}
                draggable={reorderMode}
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => reorderMode && e.preventDefault()}
                onDrop={() => {
                  if (!reorderMode) return;
                  moveItem(dragIndex, idx);
                  setDragIndex(null);
                }}
                style={{
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 12,
                  padding: 12,
                  background: reorderMode ? 'rgba(79,70,229,0.05)' : '#fff',
                  cursor: reorderMode ? 'move' : 'default',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{ev.title}</div>
                    <div style={{ color: 'rgba(0,0,0,0.7)', marginTop: 4 }}>{ev.text}</div>
                    <div style={{ color: 'rgba(0,0,0,0.55)', marginTop: 6, fontSize: 13 }}>
                      시간: {ev.time || 'any'} / 맵: {ev.mapId ? '지정' : '무관'} / 구역: {ev.zoneId ? '지정' : '무관'} / 사용:{' '}
                      {ev.enabled === false ? 'N' : 'Y'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
                    <button
                      onClick={() => handleEdit(ev)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(0,0,0,0.12)',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(ev._id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid rgba(255,0,0,0.3)',
                        background: 'rgba(255, 235, 235, 0.8)',
                        cursor: 'pointer',
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {(ev.killers?.length || ev.victims?.length || ev.benefits?.length) && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 6, fontSize: 13 }}>
                    {Array.isArray(ev.killers) && ev.killers.length > 0 && (
                      <div>
                        <b>살인자:</b> {ev.killers.join(', ')}
                      </div>
                    )}
                    {Array.isArray(ev.victims) && ev.victims.length > 0 && (
                      <div>
                        <b>피해자:</b> {ev.victims.join(', ')}
                      </div>
                    )}
                    {Array.isArray(ev.benefits) && ev.benefits.length > 0 && (
                      <div>
                        <b>이로운 효과:</b> {ev.benefits.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </main>
  );
}
