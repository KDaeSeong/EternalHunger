'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/api';
import {
  AdminKioskCreateCard,
  AdminKioskEditCard,
  AdminKioskListCard,
} from './_components/AdminKioskCards';

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
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const hydrateKiosk = (k) => {
    if (!k || typeof k !== 'object') return k;
    const mapId = k.mapId?._id || k.mapId || '';
    const map = maps.find((m) => String(m._id) === String(mapId));
    return map ? { ...k, mapId: map } : k;
  };

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
      if (res?.kiosk) setKiosks((prev) => [hydrateKiosk(res.kiosk), ...(Array.isArray(prev) ? prev : [])]);
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
      if (res?.kiosk) setKiosks((prev) => (Array.isArray(prev) ? prev.map((row) => row._id === res.kiosk._id ? hydrateKiosk(res.kiosk) : row) : [hydrateKiosk(res.kiosk)]));
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

  const removeKiosk = async (id) => {
    if (!confirm('정말 삭제할까요?')) return;
    try {
      const res = await apiDelete(`/admin/kiosks/${id}`);
      setMessage(res?.message || '삭제 완료');
      setKiosks((prev) => (Array.isArray(prev) ? prev.filter((row) => row._id !== id) : []));
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message);
    }
  };

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
        <AdminKioskCreateCard
          createForm={createForm}
          maps={maps}
          onCreate={createKiosk}
          onSetCreateForm={setCreateForm}
        />

        <AdminKioskListCard
          filtered={filtered}
          onEdit={startEdit}
          onRemove={removeKiosk}
          onSearchChange={setQ}
          q={q}
        />
      </div>

      <AdminKioskEditCard
        editing={editing}
        items={items}
        maps={maps}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        onSetEditing={setEditing}
      />
    </div>
  );
}
