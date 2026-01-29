'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/api';

function safeStringify(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

export default function AdminPerksPage() {
  const [perks, setPerks] = useState([]);
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');

  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    description: '',
    lpCost: 0,
    category: 'buff',
    effectsText: '{\n  "hpPlus": 20\n}',
    isActive: true,
  });

  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return perks;
    return perks.filter((p) => `${p.code} ${p.name} ${p.category}`.toLowerCase().includes(needle));
  }, [perks, q]);

  const load = async () => {
    try {
      const data = await apiGet('/admin/perks');
      setPerks(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const parseEffects = (text) => {
    try {
      const obj = JSON.parse(text || '{}');
      return obj && typeof obj === 'object' ? obj : {};
    } catch {
      throw new Error('effects JSON 형식이 올바르지 않습니다.');
    }
  };

  const create = async () => {
    try {
      const payload = {
        code: createForm.code,
        name: createForm.name,
        description: createForm.description,
        lpCost: Number(createForm.lpCost || 0),
        category: createForm.category,
        effects: parseEffects(createForm.effectsText),
        isActive: Boolean(createForm.isActive),
      };
      const res = await apiPost('/admin/perks', payload);
      setMessage(res?.message || '추가 완료');
      setCreateForm({ ...createForm, code: '', name: '', description: '', lpCost: 0 });
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const startEdit = (p) => {
    setEditing({
      _id: p._id,
      code: p.code || '',
      name: p.name || '',
      description: p.description || '',
      lpCost: Number(p.lpCost || 0),
      category: p.category || 'buff',
      effectsText: safeStringify(p.effects),
      isActive: Boolean(p.isActive),
    });
  };

  const save = async () => {
    if (!editing?._id) return;
    try {
      const payload = {
        code: editing.code,
        name: editing.name,
        description: editing.description,
        lpCost: Number(editing.lpCost || 0),
        category: editing.category,
        effects: parseEffects(editing.effectsText),
        isActive: Boolean(editing.isActive),
      };
      const res = await apiPut(`/admin/perks/${editing._id}`, payload);
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
      const res = await apiDelete(`/admin/perks/${id}`);
      setMessage(res?.message || '삭제 완료');
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div>
      <div className="admin-topbar">
        <h1>특전</h1>
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
          <h3 style={{ marginTop: 0 }}>신규 특전</h3>
          <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="admin-field">
              <label>code</label>
              <input value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="PERK_HP_01" />
            </div>
            <div className="admin-field">
              <label>name</label>
              <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="체력 증가" />
            </div>
          </div>
          <div className="admin-field">
            <label>description</label>
            <textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </div>

          <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="admin-field">
              <label>lpCost</label>
              <input type="number" value={createForm.lpCost} onChange={(e) => setCreateForm({ ...createForm, lpCost: e.target.value })} />
            </div>
            <div className="admin-field">
              <label>category</label>
              <select value={createForm.category} onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}>
                <option value="buff">buff</option>
                <option value="cosmetic">cosmetic</option>
                <option value="other">other</option>
              </select>
            </div>
            <div className="admin-field">
              <label>isActive</label>
              <select value={String(createForm.isActive)} onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.value === 'true' })}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
          </div>

          <div className="admin-field">
            <label>effects (JSON)</label>
            <textarea value={createForm.effectsText} onChange={(e) => setCreateForm({ ...createForm, effectsText: e.target.value })} />
          </div>
          <button className="admin-btn primary" onClick={create}>추가</button>
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>목록</h3>
          <div className="admin-field">
            <label>검색</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="code/name/category" />
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>특전</th>
                <th>비용</th>
                <th>상태</th>
                <th>조작</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{p.code} · {p.name}</div>
                    <div className="admin-muted">{p.category}</div>
                  </td>
                  <td>{p.lpCost || 0} LP</td>
                  <td className="admin-muted">{p.isActive ? '활성' : '비활성'}</td>
                  <td>
                    <div className="admin-btn-row">
                      <button className="admin-btn" onClick={() => startEdit(p)}>수정</button>
                      <button className="admin-btn danger" onClick={() => remove(p._id)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-muted">특전이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="admin-card" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>수정</h3>
          <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div className="admin-field">
                <label>code</label>
                <input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
              </div>
              <div className="admin-field">
                <label>name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="admin-field">
                <label>description</label>
                <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="admin-field">
                  <label>lpCost</label>
                  <input type="number" value={editing.lpCost} onChange={(e) => setEditing({ ...editing, lpCost: e.target.value })} />
                </div>
                <div className="admin-field">
                  <label>category</label>
                  <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                    <option value="buff">buff</option>
                    <option value="cosmetic">cosmetic</option>
                    <option value="other">other</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label>isActive</label>
                  <select value={String(editing.isActive)} onChange={(e) => setEditing({ ...editing, isActive: e.target.value === 'true' })}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </div>
              </div>
              <div className="admin-field">
                <label>effects (JSON)</label>
                <textarea value={editing.effectsText} onChange={(e) => setEditing({ ...editing, effectsText: e.target.value })} />
              </div>
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
