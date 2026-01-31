'use client';

import { useEffect, useMemo, useState } from 'react';

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

const sample = [
  { id: 'sample-1', name: '기본 포션', kind: 'consumable', price: 50, rarity: 'N' },
  { id: 'sample-2', name: '돌도끼', kind: 'gear', price: 120, rarity: 'R' },
  { id: 'sample-3', name: '헌터 키보드', kind: 'keyboard', price: 300, rarity: 'SR' },
];

export default function ItemsAdmin() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('loading'); // loading | ok | fallback | error

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/items', { credentials: 'include' });
        if (!res.ok) throw new Error('bad status');
        const data = await res.json().catch(() => null);
        const list = normalizeItems(data);
        if (!canceled) {
          setItems(list);
          setStatus('ok');
        }
      } catch {
        if (!canceled) {
          setItems(sample);
          setStatus('fallback');
        }
      }
    })();
    return () => {
      canceled = true
    };
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((it) => {
      const k = String(it.kind ?? it.category ?? '').toLowerCase();
      const n = String(it.name ?? it.itemName ?? '').toLowerCase();
      const hitQ = !query || n.includes(query) || String(it.id ?? '').toLowerCase().includes(query);
      const hitK = kind === 'all' || k === kind;
      return hitQ && hitK;
    });
  }, [items, q, kind]);

  const box = { padding: 16 };
  const card = { padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 };
  const input = { padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0b1220', color: '#e5e7eb' };
  const th = { textAlign: 'left', fontSize: 12, opacity: 0.8, padding: '8px 6px' };
  const td = { padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)' };

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>아이템 관리</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            {status === 'loading' && '불러오는 중…'}
            {status === 'ok' && `총 ${items.length}개`}
            {status === 'fallback' && `API 미연결: 샘플 ${items.length}개 표시`}
          </div>
        </div>
        <button disabled style={{ opacity: 0.5, padding: '10px 12px', borderRadius: 10 }}>+ 새 아이템(다음)</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름/ID 검색" style={{ ...input, flex: 1 }} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
          <option value="all">전체 kind</option>
          <option value="consumable">consumable</option>
          <option value="gear">gear</option>
          <option value="mouse">mouse</option>
          <option value="keyboard">keyboard</option>
          <option value="monitor">monitor</option>
        </select>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>이름</th>
              <th style={th}>kind</th>
              <th style={th}>가격</th>
              <th style={th}>희귀도</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={String(it.id ?? it.itemId ?? Math.random())}>
                <td style={td}>{String(it.id ?? it.itemId ?? '-')}</td>
                <td style={td}>{String(it.name ?? it.itemName ?? '-')}</td>
                <td style={td}>{String(it.kind ?? it.category ?? '-')}</td>
                <td style={td}>{String(it.price ?? it.gold ?? '-')}</td>
                <td style={td}>{String(it.rarity ?? '-')}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td style={td} colSpan={5}>검색 결과가 없어.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
