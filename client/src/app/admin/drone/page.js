'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/api';

export default function AdminDronePage() {
  const [offers, setOffers] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');

  const [createForm, setCreateForm] = useState({ itemId: '', priceCredits: 0, maxTier: 1, isActive: true });
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return offers;
    return offers.filter((o) => {
      const name = o.itemId?.name || '';
      return name.toLowerCase().includes(needle);
    });
  }, [offers, q]);

  const load = async () => {
    try {
      const [o, it] = await Promise.all([
        apiGet('/admin/drone-offers'),
        apiGet('/admin/items'),
      ]);
      setOffers(Array.isArray(o) ? o : []);
      setItems(Array.isArray(it) ? it : []);
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    try {
      const payload = {
        itemId: createForm.itemId,
        priceCredits: Number(createForm.priceCredits || 0),
        maxTier: Number(createForm.maxTier || 1),
        isActive: Boolean(createForm.isActive),
      };
      const res = await apiPost('/admin/drone-offers', payload);
      setMessage(res?.message || '추가 완료');
      setCreateForm({ itemId: '', priceCredits: 0, maxTier: 1, isActive: true });
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const startEdit = (o) => {
    setEditing({
      _id: o._id,
      itemId: o.itemId?._id || o.itemId,
      priceCredits: Number(o.priceCredits || 0),
      maxTier: Number(o.maxTier || 1),
      isActive: Boolean(o.isActive),
    });
  };

  const save = async () => {
    if (!editing?._id) return;
    try {
      const payload = {
        itemId: editing.itemId,
        priceCredits: Number(editing.priceCredits || 0),
        maxTier: Number(editing.maxTier || 1),
        isActive: Boolean(editing.isActive),
      };
      const res = await apiPut(`/admin/drone-offers/${editing._id}`, payload);
      setMessage(res?.message || '수정 완료');
      setEditing(null);
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/admin/drone-offers/${id}`);
      setMessage(res?.message || '삭제 완료');
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div>
      <div className="admin-topbar">
        <h1>전송 드론 판매</h1>
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
          <h3 style={{ marginTop: 0 }}>판매 항목 추가</h3>
          <div className="admin-field">
            <label>아이템</label>
            <select value={createForm.itemId} onChange={(e) => setCreateForm({ ...createForm, itemId: e.target.value })}>
              <option value="">선택</option>
              {items.map((it) => <option key={it._id} value={it._id}>{it.name}</option>)}
            </select>
          </div>
          <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="admin-field">
              <label>가격(credits)</label>
              <input type="number" value={createForm.priceCredits} onChange={(e) => setCreateForm({ ...createForm, priceCredits: e.target.value })} />
            </div>
            <div className="admin-field">
              <label>최대 티어(maxTier)</label>
              <input type="number" value={createForm.maxTier} onChange={(e) => setCreateForm({ ...createForm, maxTier: e.target.value })} />
            </div>
            <div className="admin-field">
              <label>활성</label>
              <select value={String(createForm.isActive)} onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.value === 'true' })}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
          </div>
          <button className="admin-btn primary" onClick={create}>추가</button>
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>목록</h3>
          <div className="admin-field">
            <label>검색(아이템 이름)</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 붕대" />
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>아이템</th>
                <th>가격</th>
                <th>제한</th>
                <th>조작</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{o.itemId?.name || '알 수 없음'}</div>
                    <div className="admin-muted">{o.isActive ? '활성' : '비활성'}</div>
                  </td>
                  <td>{o.priceCredits || 0}</td>
                  <td className="admin-muted">tier ≤ {o.maxTier || 1}</td>
                  <td>
                    <div className="admin-btn-row">
                      <button className="admin-btn" onClick={() => startEdit(o)}>수정</button>
                      <button className="admin-btn danger" onClick={() => remove(o._id)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-muted">항목이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="admin-card" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>수정</h3>
          <div className="admin-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
            <div className="admin-field">
              <label>아이템</label>
              <select value={editing.itemId} onChange={(e) => setEditing({ ...editing, itemId: e.target.value })}>
                <option value="">선택</option>
                {items.map((it) => <option key={it._id} value={it._id}>{it.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>가격</label>
              <input type="number" value={editing.priceCredits} onChange={(e) => setEditing({ ...editing, priceCredits: e.target.value })} />
            </div>
            <div className="admin-field">
              <label>maxTier</label>
              <input type="number" value={editing.maxTier} onChange={(e) => setEditing({ ...editing, maxTier: e.target.value })} />
            </div>
            <div className="admin-field">
              <label>활성</label>
              <select value={String(editing.isActive)} onChange={(e) => setEditing({ ...editing, isActive: e.target.value === 'true' })}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
          </div>
          <div className="admin-btn-row">
            <button className="admin-btn primary" onClick={save}>저장</button>
            <button className="admin-btn" onClick={() => setEditing(null)}>닫기</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
