'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/api';

export default function AdminMapsPage() {
  const [maps, setMaps] = useState([]);
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    image: '',
  });

  const [connect, setConnect] = useState({ a: '', b: '' });
  const [editing, setEditing] = useState(null);

  const safeJsonParse = (text, fallback, label) => {
    if (text == null) return fallback;
    const trimmed = String(text).trim();
    if (!trimmed) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      throw new Error(`${label} JSON 파싱 실패: ${e.message}`);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return maps;
    return maps.filter((m) => `${m.name} ${m.description || ''}`.toLowerCase().includes(needle));
  }, [maps, q]);

  const load = async () => {
    try {
      const data = await apiGet('/admin/maps');
      setMaps(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createMap = async () => {
    try {
      const res = await apiPost('/admin/maps', createForm);
      setMessage(res?.message || '생성 완료');
      setCreateForm({ name: '', description: '', image: '' });
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const connectMaps = async () => {
    if (!connect.a || !connect.b) {
      setMessage('구역 A/B를 모두 선택하세요.');
      return;
    }
    if (connect.a === connect.b) {
      setMessage('같은 구역은 연결할 수 없습니다.');
      return;
    }
    try {
      const res = await apiPut(`/admin/maps/${connect.a}/connect`, { targetMapId: connect.b });
      setMessage(res?.message || '연결 완료');
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const startEdit = (m) => {
    setEditing({
      _id: m._id,
      name: m.name || '',
      description: m.description || '',
      image: m.image || '',
      showAdvanced: false,
      zonesText: JSON.stringify(m.zones || [], null, 2),
      zoneConnectionsText: JSON.stringify(m.zoneConnections || [], null, 2),
      forbiddenConfigText: JSON.stringify(m.forbiddenZoneConfig || { enabled: false, startPhase: 3, damagePerTick: 5 }, null, 2),
      spawnsText: JSON.stringify(m.spawns || { animals: [], mutants: [] }, null, 2),
      itemCratesText: JSON.stringify(m.itemCrates || [], null, 2),
    });
  };

  const saveEdit = async () => {
    if (!editing?._id) return;
    try {
      const body = {
        name: editing.name,
        description: editing.description,
        image: editing.image,
        zones: safeJsonParse(editing.zonesText, [], 'zones'),
        zoneConnections: safeJsonParse(editing.zoneConnectionsText, [], 'zoneConnections'),
        forbiddenZoneConfig: safeJsonParse(editing.forbiddenConfigText, { enabled: false, startPhase: 3, damagePerTick: 5 }, 'forbiddenZoneConfig'),
        spawns: safeJsonParse(editing.spawnsText, { animals: [], mutants: [] }, 'spawns'),
        itemCrates: safeJsonParse(editing.itemCratesText, [], 'itemCrates'),
      };
      const res = await apiPut(`/admin/maps/${editing._id}`, body);
      setMessage(res?.message || '수정 완료');
      setEditing(null);
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const removeMap = async (id) => {
    if (!confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/admin/maps/${id}`);
      setMessage(res?.message || '삭제 완료');
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div>
      <div className="admin-topbar">
        <h1>맵 / 구역</h1>
        <div className="admin-btn-row">
          <button className="admin-btn" onClick={load}>새로고침</button>
        </div>
      </div>

      {message ? (
        <div className="admin-card" style={{ marginBottom: 14 }}>
          <div className="admin-muted">메시지</div>
          <div style={{ marginTop: 6 }}>{message}</div>
        </div>
      ) : null}

      <div className="admin-grid">
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>구역 생성</h3>
          <div className="admin-field">
            <label>구역 이름</label>
            <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="예: 숲, 공장" />
          </div>
          <div className="admin-field">
            <label>설명</label>
            <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </div>
          <div className="admin-field">
            <label>이미지 URL(선택)</label>
            <input value={createForm.image} onChange={(e) => setCreateForm({ ...createForm, image: e.target.value })} placeholder="https://..." />
          </div>
          <button className="admin-btn primary" onClick={createMap}>생성</button>

          <h3 style={{ marginTop: 22 }}>동선 연결</h3>
          <div className="admin-muted">두 구역을 양방향으로 연결합니다.</div>
          <div className="admin-grid" style={{ marginTop: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div className="admin-field">
              <label>구역 A</label>
              <select value={connect.a} onChange={(e) => setConnect({ ...connect, a: e.target.value })}>
                <option value="">선택</option>
                {maps.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>구역 B</label>
              <select value={connect.b} onChange={(e) => setConnect({ ...connect, b: e.target.value })}>
                <option value="">선택</option>
                {maps.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <button className="admin-btn" onClick={connectMaps}>연결하기</button>
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>구역 목록</h3>
          <div className="admin-field">
            <label>검색</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="구역 이름/설명" />
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>구역</th>
                <th>연결</th>
                <th>조작</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div className="admin-muted">{m.description || '설명 없음'}</div>
                  </td>
                  <td className="admin-muted">
                    <div>
                      {Array.isArray(m.connectedMaps) && m.connectedMaps.length
                        ? m.connectedMaps.map((x) => x?.name || x).join(', ')
                        : '연결 없음'}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      내부 구역: {Array.isArray(m.zones) ? m.zones.length : 0}개 / 동선: {Array.isArray(m.zoneConnections) ? m.zoneConnections.length : 0}개
                    </div>
                  </td>
                  <td>
                    <div className="admin-btn-row">
                      <button className="admin-btn" onClick={() => startEdit(m)}>수정</button>
                      <button className="admin-btn danger" onClick={() => removeMap(m._id)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="admin-muted">구역이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="admin-card" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>구역 수정</h3>
          <div className="admin-grid">
            <div>
              <div className="admin-field">
                <label>이름</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="admin-field">
                <label>이미지 URL</label>
                <input value={editing.image} onChange={(e) => setEditing({ ...editing, image: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="admin-field">
                <label>설명</label>
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="admin-btn-row" style={{ marginTop: 8 }}>
            <button className="admin-btn" onClick={() => setEditing({ ...editing, showAdvanced: !editing.showAdvanced })}>
              {editing.showAdvanced ? '고급 설정 닫기' : '고급 설정 열기(내부 구역/동선/스폰/상자)'}
            </button>
          </div>

          {editing.showAdvanced ? (
            <div className="admin-card" style={{ marginTop: 12, background: '#0b1220' }}>
              <div className="admin-muted" style={{ marginBottom: 8 }}>
                아래는 JSON 직접 편집 영역입니다. 저장 시 파싱 오류가 나면 메시지에 표시됩니다.
              </div>
              <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="admin-field">
                  <label>zones (맵 내부 구역)</label>
                  <textarea value={editing.zonesText} onChange={(e) => setEditing({ ...editing, zonesText: e.target.value })} rows={10} />
                </div>
                <div className="admin-field">
                  <label>zoneConnections (내부 구역 동선)</label>
                  <textarea value={editing.zoneConnectionsText} onChange={(e) => setEditing({ ...editing, zoneConnectionsText: e.target.value })} rows={10} />
                </div>
                <div className="admin-field">
                  <label>forbiddenZoneConfig (금지구역)</label>
                  <textarea value={editing.forbiddenConfigText} onChange={(e) => setEditing({ ...editing, forbiddenConfigText: e.target.value })} rows={8} />
                </div>
                <div className="admin-field">
                  <label>spawns (야생동물/변이체)</label>
                  <textarea value={editing.spawnsText} onChange={(e) => setEditing({ ...editing, spawnsText: e.target.value })} rows={8} />
                </div>
              </div>
              <div className="admin-field" style={{ marginTop: 10 }}>
                <label>itemCrates (아이템 상자)</label>
                <textarea value={editing.itemCratesText} onChange={(e) => setEditing({ ...editing, itemCratesText: e.target.value })} rows={10} />
              </div>
            </div>
          ) : null}

          <div className="admin-btn-row">
            <button className="admin-btn primary" onClick={saveEdit}>저장</button>
            <button className="admin-btn" onClick={() => setEditing(null)}>닫기</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
