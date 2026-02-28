'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/api';

const emptyCatalogRow = () => ({
  itemId: '',
  mode: 'sell',
  priceCredits: 0,
  exchange: { giveItemId: '', giveQty: 1 },
});

export default function AdminKiosksPage() {
  const [kiosks, setKiosks] = useState([]);
  const [maps, setMaps] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');

  const [createForm, setCreateForm] = useState({ kioskId: '', name: '키오스크', mapId: '', x: 0, y: 0 });
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return kiosks;
    return kiosks.filter((k) => `${k.kioskId} ${k.name} ${(k.mapId?.name || '')}`.toLowerCase().includes(needle));
  }, [kiosks, q]);

  const load = async () => {
    try {
      const [k, m, it] = await Promise.all([
        apiGet('/admin/kiosks'),
        apiGet('/admin/maps'),
        apiGet('/admin/items'),
      ]);
      setKiosks(Array.isArray(k) ? k : []);
      setMaps(Array.isArray(m) ? m : []);
      setItems(Array.isArray(it) ? it : []);
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createKiosk = async () => {
    try {
      const payload = {
        ...createForm,
        x: Number(createForm.x || 0),
        y: Number(createForm.y || 0),
        catalog: [],
      };
      const res = await apiPost('/admin/kiosks', payload);
      setMessage(res?.message || '추가 완료');
      setCreateForm({ kioskId: '', name: '키오스크', mapId: '', x: 0, y: 0 });
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const startEdit = (k) => {
    setEditing({
      _id: k._id,
      kioskId: k.kioskId || '',
      name: k.name || '키오스크',
      mapId: k.mapId?._id || k.mapId || '',
      x: Number(k.x || 0),
      y: Number(k.y || 0),
      catalog: Array.isArray(k.catalog) ? k.catalog.map((row) => ({
        itemId: row.itemId?._id || row.itemId || '',
        mode: row.mode || 'sell',
        priceCredits: Number(row.priceCredits || 0),
        exchange: {
          giveItemId: row.exchange?.giveItemId?._id || row.exchange?.giveItemId || '',
          giveQty: Number(row.exchange?.giveQty || 1),
        },
      })) : [],
    });
  };

  const saveEdit = async () => {
    if (!editing?._id) return;
    try {
      const payload = {
        kioskId: editing.kioskId,
        name: editing.name,
        mapId: editing.mapId,
        x: Number(editing.x || 0),
        y: Number(editing.y || 0),
        catalog: (editing.catalog || []).map((row) => ({
          itemId: row.itemId,
          mode: row.mode,
          priceCredits: Number(row.priceCredits || 0),
          exchange: {
            giveItemId: row.exchange?.giveItemId || undefined,
            giveQty: Number(row.exchange?.giveQty || 1),
          },
        })),
      };
      const res = await apiPut(`/admin/kiosks/${editing._id}`, payload);
      setMessage(res?.message || '수정 완료');
      setEditing(null);
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const removeKiosk = async (id) => {
    if (!confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/admin/kiosks/${id}`);
      setMessage(res?.message || '삭제 완료');
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const itemName = (id) => items.find((x) => x._id === id)?.name || '선택';

  return (
    <div>
      <div className="admin-topbar">
        <h1>키오스크</h1>
        <div className="admin-btn-row">
          <button className="admin-btn" onClick={load}>새로고침</button>
          <button className="admin-btn" onClick={async () => {
            try {
              const r = await apiPost('/admin/kiosks/generate', { mode: 'missing' });
              setMessage(r?.message || '키오스크 자동 생성 완료');
              await load();
            } catch (e) {
              setMessage(e?.response?.data?.error || e.message);
            }
          }}>자동 생성</button>
          <button className="admin-btn" onClick={async () => {
            try {
              const r = await apiPost('/admin/kiosks/normalize', {});
              setMessage(r?.message || '키오스크 정규화 완료');
              await load();
            } catch (e) {
              setMessage(e?.response?.data?.error || e.message);
            }
          }}>정규화</button>
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
          <h3 style={{ marginTop: 0 }}>키오스크 생성</h3>

          <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="admin-field">
              <label>kioskId (예: KIOSK_001)</label>
              <input value={createForm.kioskId} onChange={(e) => setCreateForm({ ...createForm, kioskId: e.target.value })} />
            </div>
            <div className="admin-field">
              <label>이름</label>
              <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            </div>
          </div>

          <div className="admin-field">
            <label>배치 구역(mapId)</label>
            <select value={createForm.mapId} onChange={(e) => setCreateForm({ ...createForm, mapId: e.target.value })}>
              <option value="">선택</option>
              {maps.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>

          <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="admin-field">
              <label>x</label>
              <input type="number" value={createForm.x} onChange={(e) => setCreateForm({ ...createForm, x: e.target.value })} />
            </div>
            <div className="admin-field">
              <label>y</label>
              <input type="number" value={createForm.y} onChange={(e) => setCreateForm({ ...createForm, y: e.target.value })} />
            </div>
          </div>

          <button className="admin-btn primary" onClick={createKiosk}>생성</button>
          <div className="admin-muted" style={{ marginTop: 10 }}>
            생성 후 “수정”에서 판매/교환 카탈로그를 편집하세요.
          </div>
        </div>

        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>목록</h3>
          <div className="admin-field">
            <label>검색</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="kioskId/이름/구역" />
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>키오스크</th>
                <th>구역</th>
                <th>카탈로그</th>
                <th>조작</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => (
                <tr key={k._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{k.kioskId} · {k.name}</div>
                    <div className="admin-muted">({k.x || 0}, {k.y || 0})</div>
                  </td>
                  <td className="admin-muted">{k.mapId?.name || '미지정'}</td>
                  <td className="admin-muted">{Array.isArray(k.catalog) ? k.catalog.length : 0}개</td>
                  <td>
                    <div className="admin-btn-row">
                      <button className="admin-btn" onClick={() => startEdit(k)}>수정</button>
                      <button className="admin-btn danger" onClick={() => removeKiosk(k._id)}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-muted">키오스크가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {editing ? (
        <div className="admin-card" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>키오스크 수정</h3>

          <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="admin-field">
                  <label>kioskId</label>
                  <input value={editing.kioskId} onChange={(e) => setEditing({ ...editing, kioskId: e.target.value })} />
                </div>
                <div className="admin-field">
                  <label>이름</label>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
              </div>
              <div className="admin-field">
                <label>구역(mapId)</label>
                <select value={editing.mapId} onChange={(e) => setEditing({ ...editing, mapId: e.target.value })}>
                  <option value="">선택</option>
                  {maps.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div className="admin-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="admin-field">
                  <label>x</label>
                  <input type="number" value={editing.x} onChange={(e) => setEditing({ ...editing, x: e.target.value })} />
                </div>
                <div className="admin-field">
                  <label>y</label>
                  <input type="number" value={editing.y} onChange={(e) => setEditing({ ...editing, y: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <div className="admin-muted" style={{ marginBottom: 8 }}>카탈로그(판매/구매/교환)</div>
              <div className="admin-btn-row" style={{ marginBottom: 8 }}>
                <button className="admin-btn" onClick={() => setEditing({ ...editing, catalog: [...(editing.catalog || []), emptyCatalogRow()] })}>+ 항목 추가</button>
              </div>
              {(editing.catalog || []).map((row, idx) => (
                <div key={idx} className="admin-card" style={{ padding: 12, marginBottom: 10 }}>
                  <div className="admin-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <div className="admin-field">
                      <label>아이템</label>
                      <select value={row.itemId} onChange={(e) => {
                        const next = [...editing.catalog];
                        next[idx] = { ...next[idx], itemId: e.target.value };
                        setEditing({ ...editing, catalog: next });
                      }}>
                        <option value="">선택</option>
                        {items.map((it) => <option key={it._id} value={it._id}>{it.name}</option>)}
                      </select>
                    </div>
                    <div className="admin-field">
                      <label>모드</label>
                      <select value={row.mode} onChange={(e) => {
                        const next = [...editing.catalog];
                        next[idx] = { ...next[idx], mode: e.target.value };
                        setEditing({ ...editing, catalog: next });
                      }}>
                        <option value="sell">sell</option>
                        <option value="buy">buy</option>
                        <option value="exchange">exchange</option>
                      </select>
                    </div>
                    <div className="admin-field">
                      <label>가격(credits)</label>
                      <input type="number" value={row.priceCredits} onChange={(e) => {
                        const next = [...editing.catalog];
                        next[idx] = { ...next[idx], priceCredits: e.target.value };
                        setEditing({ ...editing, catalog: next });
                      }} />
                    </div>
                  </div>

                  {row.mode === 'exchange' ? (
                    <div className="admin-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                      <div className="admin-field">
                        <label>교환: 주는 아이템(giveItemId)</label>
                        <select value={row.exchange?.giveItemId || ''} onChange={(e) => {
                          const next = [...editing.catalog];
                          next[idx] = { ...next[idx], exchange: { ...(next[idx].exchange || {}), giveItemId: e.target.value } };
                          setEditing({ ...editing, catalog: next });
                        }}>
                          <option value="">선택</option>
                          {items.map((it) => <option key={it._id} value={it._id}>{it.name}</option>)}
                        </select>
                      </div>
                      <div className="admin-field">
                        <label>교환: 수량(giveQty)</label>
                        <input type="number" value={row.exchange?.giveQty || 1} onChange={(e) => {
                          const next = [...editing.catalog];
                          next[idx] = { ...next[idx], exchange: { ...(next[idx].exchange || {}), giveQty: e.target.value } };
                          setEditing({ ...editing, catalog: next });
                        }} />
                      </div>
                    </div>
                  ) : null}

                  <div className="admin-btn-row">
                    <button className="admin-btn danger" onClick={() => {
                      const next = [...editing.catalog];
                      next.splice(idx, 1);
                      setEditing({ ...editing, catalog: next });
                    }}>항목 삭제</button>
                    <div className="admin-muted" style={{ marginLeft: 'auto' }}>
                      {row.itemId ? `대상: ${itemName(row.itemId)}` : '아이템 선택 필요'}
                    </div>
                  </div>
                </div>
              ))}
              {(editing.catalog || []).length === 0 ? (
                <div className="admin-muted">카탈로그가 비어있습니다.</div>
              ) : null}
            </div>
          </div>

          <div className="admin-btn-row" style={{ marginTop: 12 }}>
            <button className="admin-btn primary" onClick={saveEdit}>저장</button>
            <button className="admin-btn" onClick={() => setEditing(null)}>닫기</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
