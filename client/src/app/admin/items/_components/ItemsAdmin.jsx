'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE, getToken } from '../../../../utils/api';

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function adaptItem(raw) {
  const it = raw || {};
  const id = it.id ?? it._id ?? it.itemId ?? it.item_id;
  const kind = it.kind ?? it.category ?? it.type ?? it.itemType;
  const price = it.price ?? it.gold ?? it.value ?? it.baseCreditValue ?? it.creditValue;
  const name = it.name ?? it.itemName ?? it.title;
  const rarity = it.rarity ?? it.grade ?? it.rank;

  return {
    ...it,
    id,
    kind,
    price,
    name,
    rarity,
  };
}

function authHeaders() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` };
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
  const [treeBusy, setTreeBusy] = useState(false);
  const [treeMsg, setTreeMsg] = useState('');

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/items`, {
          headers: { ...authHeaders() },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('bad status');
        const data = await res.json().catch(() => null);
        const list = normalizeItems(data).map(adaptItem);
        if (!canceled) {
          setItems(list);
          setStatus('ok');
        }
      } catch {
        if (!canceled) {
          // 서버/API가 연결되지 않은 환경에서도 화면이 깨지지 않게 샘플을 보여주되,
          // 실제 데이터가 필요하면 API_BASE/토큰 설정을 먼저 확인하도록 유도
          setItems(sample.map(adaptItem));
          setStatus('fallback');
        }
      }
    })();
    return () => {
      canceled = true
    };
  }, []);

  async function generateDefaultTree(mode = 'missing') {
    if (treeBusy) return;
    setTreeBusy(true);
    setTreeMsg('');
    try {
      const res = await fetch(`${API_BASE}/admin/items/generate-default-tree`, {
        method: 'POST',
        // 서버는 JWT(Bearer) 기반이므로 쿠키에 의존하지 않음
        // (배포/로컬 모두 동일하게 동작하도록 Authorization 헤더 사용)
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'failed');
      setTreeMsg(`✅ ${data?.message || '완료'} (created:${data?.summary?.createdCount ?? 0}, recipe:${data?.summary?.recipeUpdatedCount ?? 0})`);

      // 아이템 목록 리로드
      const r2 = await fetch(`${API_BASE}/admin/items`, { headers: { ...authHeaders() }, cache: 'no-store' });
      if (r2.ok) {
        const d2 = await r2.json().catch(() => null);
        const list = normalizeItems(d2).map(adaptItem);
        setItems(list);
        setStatus('ok');
      }
    } catch (e) {
      setTreeMsg(`⚠️ 기본 아이템 트리 생성 실패: ${String(e?.message || e)}`);
    } finally {
      setTreeBusy(false);
    }
  }


  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((it) => {
      const k = String(it.kind ?? it.category ?? it.type ?? '').toLowerCase();
      const n = String(it.name ?? it.itemName ?? '').toLowerCase();
      const hitQ = !query || n.includes(query) || String(it.id ?? '').toLowerCase().includes(query);
      const hitK = kind === 'all' || k === String(kind).toLowerCase();
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
            {status === 'fallback' && `API 미연결(또는 권한/토큰 문제): 샘플 ${items.length}개 표시`}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => generateDefaultTree('missing')}
            disabled={treeBusy}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'inherit', cursor: treeBusy ? 'not-allowed' : 'pointer' }}
            title="없는 아이템만 추가 + 레시피가 비어있을 때만 채움(권장)"
          >
            {treeBusy ? '생성 중…' : '기본 아이템 트리 생성'}
          </button>
          <button
            onClick={() => generateDefaultTree('force')}
            disabled={treeBusy}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,120,120,0.35)', background: 'rgba(255,80,80,0.12)', color: 'inherit', cursor: treeBusy ? 'not-allowed' : 'pointer' }}
            title="⚠️ 동일 이름 아이템을 기본값으로 덮어씁니다(주의)"
          >
            강제 덮어쓰기
          </button>
        </div>

        <button disabled style={{ opacity: 0.5, padding: '10px 12px', borderRadius: 10 }}>+ 새 아이템(다음)</button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.95 }}>{treeMsg}</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름/ID 검색" style={{ ...input, flex: 1 }} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
          <option value="all">전체 분류</option>
          <option value="무기">무기</option>
          <option value="방어구">방어구</option>
          <option value="소모품">소모품</option>
          <option value="재료">재료</option>
          <option value="기타">기타</option>
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
                <td style={td}>{String(it.kind ?? it.category ?? it.type ?? '-')}</td>
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
