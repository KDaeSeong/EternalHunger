'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../../utils/api';
import ItemEditorModal from './ItemEditorModal';
import {
  PAGE_SIZE_OPTIONS,
  formatEquipSlot,
  formatItemStatsSummary,
  getItemMongoId,
  isSimulationItem,
} from './itemsAdminUtils';

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function adaptItem(raw) {
  const it = raw || {};
  const mongoId = it._id ?? it.id ?? it.itemId ?? it.item_id;
  const externalId = it.externalId ?? it.external_id;
  const itemKey = it.itemKey ?? it.key;
  const id = itemKey ?? externalId ?? mongoId;

  const kind = it.kind ?? it.category ?? it.type ?? it.itemType;
  const price = it.price ?? it.gold ?? it.value ?? it.baseCreditValue ?? it.creditValue;
  const name = it.name ?? it.itemName ?? it.title;
  const rarity = it.rarity ?? it.grade ?? it.rank;

  return {
    ...it,
    id,
    mongoId,
    externalId,
    itemKey,
    kind,
    price,
    name,
    rarity,
  };
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
  const [simOnly, setSimOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [deletingIds, setDeletingIds] = useState(() => new Set());
  const [status, setStatus] = useState('loading'); // loading | ok | fallback
  const [treeBusy, setTreeBusy] = useState(false);
  const [treeMsg, setTreeMsg] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editorItem, setEditorItem] = useState(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const data = await apiGet('/admin/items');
        const list = normalizeItems(data).map(adaptItem);
        if (!canceled) {
          setItems(list);
          setStatus('ok');
        }
      } catch {
        if (!canceled) {
          setItems(sample.map(adaptItem));
          setStatus('fallback');
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  async function reloadItems() {
    const data = await apiGet('/admin/items');
    const list = normalizeItems(data).map(adaptItem);
    setItems(list);
    setStatus('ok');
  }

  async function runDefaultTreeBatch(mode) {
    const limit = 100;
    const totals = {
      treeCount: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      recipeUpdatedCount: 0,
      deletedCount: 0,
    };
    const labels = { items: '아이템', recipes: '레시피', cleanup: '정리' };
    const callBatch = async (phase, offset = 0) => {
      const data = await apiPost('/admin/items/generate-default-tree', {
        mode,
        batch: true,
        phase,
        offset,
        limit,
      }, { timeoutMs: 45000 });
      const s = data?.summary || {};
      totals.treeCount = Math.max(totals.treeCount, Number(s.treeCount || 0));
      totals.createdCount += Number(s.createdCount || 0);
      totals.updatedCount += Number(s.updatedCount || 0);
      totals.skippedCount += Number(s.skippedCount || 0);
      totals.recipeUpdatedCount += Number(s.recipeUpdatedCount || 0);
      totals.deletedCount += Number(s.deletedCount || 0);
      const doneCount = phase === 'cleanup'
        ? totals.deletedCount
        : Math.min(Number(s.nextOffset || 0), Number(s.treeCount || 0));
      const suffix = phase === 'cleanup'
        ? `삭제 ${totals.deletedCount}개`
        : `${doneCount}/${Number(s.treeCount || 0)}`;
      setTreeMsg(`⏳ 기본 아이템 트리 ${labels[phase] || phase} 적용 중... ${suffix}`);
      return s;
    };

    for (const phase of ['items', 'recipes']) {
      let offset = 0;
      for (;;) {
        const s = await callBatch(phase, offset);
        if (s.done) break;
        offset = Number(s.nextOffset || 0);
      }
    }

    if (mode === 'replace') {
      for (;;) {
        const s = await callBatch('cleanup', 0);
        if (s.done) break;
      }
    }

    return totals;
  }

  async function generateDefaultTree(mode = 'missing') {
    if (treeBusy) return;
    if (mode === 'replace') {
      const ok = window.confirm('현재 계정의 아이템을 namu: 기본 트리 항목으로 교체합니다.\n기본 트리에 없는 기존 아이템은 삭제됩니다.\n계속할까요?');
      if (!ok) return;
    }
    setTreeBusy(true);
    setTreeMsg('');
    try {
      const summary = await runDefaultTreeBatch(mode);
      setTreeMsg(`✅ 기본 아이템 트리 적용 완료 (tree:${summary.treeCount}, created:${summary.createdCount}, updated:${summary.updatedCount}, deleted:${summary.deletedCount}, recipe:${summary.recipeUpdatedCount})`);
      await reloadItems();
    } catch (e) {
      setTreeMsg(`⚠️ 기본 아이템 트리 생성 실패: ${String(e?.message || e)}`);
    } finally {
      setTreeBusy(false);
    }
  }

  async function deleteNonNamuItems() {
    if (treeBusy) return;
    const ok = window.confirm('ID(itemKey/externalId)에 namu:가 붙지 않은 현재 계정 아이템을 삭제합니다.\nnamu: 항목은 보존됩니다.\n계속할까요?');
    if (!ok) return;

    setTreeBusy(true);
    setTreeMsg('');
    let deletedTotal = 0;
    try {
      for (;;) {
        const data = await apiPost('/admin/items/delete-non-namu', { limit: 200 }, { timeoutMs: 45000 });
        const s = data?.summary || {};
        deletedTotal += Number(s.deletedCount || 0);
        setTreeMsg(`⏳ namu: 외 아이템 삭제 중... ${deletedTotal}개 삭제`);
        if (s.done) break;
      }
      setTreeMsg(`✅ namu: 외 아이템 ${deletedTotal}개 삭제 완료`);
      await reloadItems();
    } catch (e) {
      setTreeMsg(`⚠️ namu: 외 아이템 삭제 실패: ${String(e?.message || e)}`);
    } finally {
      setTreeBusy(false);
    }
  }

  async function dedupeNamuItems() {
    if (treeBusy) return;
    const ok = window.confirm('현재 계정의 namu: 아이템 중 같은 ID(itemKey/externalId)를 가진 중복 항목을 정리합니다.\n레시피/스폰 정보가 더 많은 항목을 우선 보존하고, 참조도 보존 항목으로 옮깁니다.\n계속할까요?');
    if (!ok) return;

    setTreeBusy(true);
    setTreeMsg('');
    let deletedTotal = 0;
    let mergedTotal = 0;
    let refTotal = 0;
    try {
      for (;;) {
        const data = await apiPost('/admin/items/dedupe', { prefix: 'namu:', limitGroups: 50 }, { timeoutMs: 45000 });
        const s = data?.summary || {};
        deletedTotal += Number(s.deletedCount || 0);
        mergedTotal += Number(s.mergedCount || 0);
        refTotal += Number(s.referenceUpdatedCount || 0);
        setTreeMsg(`⏳ namu: 중복 정리 중... 삭제 ${deletedTotal}개 / 병합 ${mergedTotal}개 / 참조 수정 ${refTotal}개`);
        if (s.done) break;
      }
      setTreeMsg(`✅ namu: 중복 정리 완료 (삭제 ${deletedTotal}개, 병합 ${mergedTotal}개, 참조 수정 ${refTotal}개)`);
      await reloadItems();
    } catch (e) {
      setTreeMsg(`⚠️ namu: 중복 정리 실패: ${String(e?.message || e)}`);
    } finally {
      setTreeBusy(false);
    }
  }

  function openCreate() {
    setEditorMode('create');
    setEditorItem(null);
    setEditorOpen(true);
  }

  function openEdit(it) {
    setEditorMode('edit');
    setEditorItem(it);
    setEditorOpen(true);
  }

  async function saveItem(payload, id) {
    let saved = null;
    if (id) {
      const res = await apiPut(`/admin/items/${id}`, payload);
      saved = res?.item || null;
    } else {
      const res = await apiPost('/admin/items', payload);
      saved = res?.item || null;
    }
    if (saved && getItemMongoId(saved)) {
      setItems((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const savedId = getItemMongoId(saved);
        const exists = list.some((row) => getItemMongoId(row) === savedId);
        if (exists) return list.map((row) => (getItemMongoId(row) === savedId ? saved : row));
        return [saved, ...list];
      });
      setEditorItem(saved);
    } else {
      await reloadItems();
    }
  }

  async function deleteItem(it) {
    const id = getItemMongoId(it);
    if (!id) return;
    const name = String(it?.name || it?.itemName || '아이템');
    const ok = window.confirm(`정말 삭제할까요?\n\n- ${name}`);
    if (!ok) return;

    const before = items;
    setDeletingIds((prev) => new Set([...prev, id]));
    setItems((prev) => (Array.isArray(prev) ? prev.filter((row) => getItemMongoId(row) !== id) : []));
    if (getItemMongoId(editorItem) === id) {
      setEditorOpen(false);
      setEditorItem(null);
    }

    try {
      await apiDelete(`/admin/items/${id}`);
      setTreeMsg(`${name} 삭제 완료`);
    } catch (e) {
      setItems(before);
      setTreeMsg(`${name} 삭제 실패`);
      throw e;
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((it) => {
      const k = String(it.kind ?? it.category ?? it.type ?? '').toLowerCase();
      const n = String(it.name ?? it.itemName ?? '').toLowerCase();
      const hitQ = !query || n.includes(query) || String(it.id ?? '').toLowerCase().includes(query);
      const hitK = kind === 'all' || k === String(kind).toLowerCase();
      const hitSim = !simOnly || isSimulationItem(it);
      return hitQ && hitK && hitSim;
    });
  }, [items, q, kind, simOnly]);
  const hasActiveFilter = Boolean(q.trim()) || kind !== 'all' || simOnly;
  const scopeStats = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    let namu = 0;
    let simulation = 0;
    let custom = 0;
    let locked = 0;
    for (const it of list) {
      const key = String(it?.itemKey || it?.externalId || it?.id || '');
      const isNamu = key.startsWith('namu:');
      const isSim = isSimulationItem(it);
      if (isNamu) namu += 1;
      if (isSim) simulation += 1;
      if (!isNamu && !isSim) custom += 1;
      if (it?.lockedByAdmin) locked += 1;
    }
    return { total: list.length, namu, simulation, custom, locked };
  }, [items]);

  function resetFilters() {
    setQ('');
    setKind('all');
    setSimOnly(false);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedItems = useMemo(() => {
    const size = Math.max(1, Number(pageSize || 100));
    const start = (safePage - 1) * size;
    return filtered.slice(start, start + size);
  }, [filtered, pageSize, safePage]);

  const box = { padding: 16 };
  const card = { padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 };
  const input = { padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0b1220', color: '#e5e7eb' };
  const th = { textAlign: 'left', fontSize: 12, opacity: 0.8, padding: '8px 6px' };
  const td = { padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top' };

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>아이템 관리</div>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            {status === 'loading' && '불러오는 중…'}
            {status === 'ok' && `현재 계정 아이템 ${items.length}개`}
            {status === 'fallback' && `API 미연결(또는 권한/토큰 문제): 샘플 ${items.length}개 표시`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
          <button
            onClick={() => generateDefaultTree('replace')}
            disabled={treeBusy}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,170,80,0.45)', background: 'rgba(255,150,40,0.14)', color: 'inherit', cursor: treeBusy ? 'not-allowed' : 'pointer' }}
            title="기존 계정 아이템을 삭제하고 기본 트리 818건으로 교체합니다."
          >
            기존 삭제 후 적용
          </button>
          <button
            onClick={deleteNonNamuItems}
            disabled={treeBusy}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,190,90,0.45)', background: 'rgba(255,180,60,0.12)', color: 'inherit', cursor: treeBusy ? 'not-allowed' : 'pointer' }}
            title="itemKey/externalId 중 어느 쪽도 namu:로 시작하지 않는 현재 계정 아이템만 삭제합니다."
          >
            namu 외 삭제
          </button>
          <button
            onClick={dedupeNamuItems}
            disabled={treeBusy}
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(120,210,255,0.45)', background: 'rgba(80,180,255,0.12)', color: 'inherit', cursor: treeBusy ? 'not-allowed' : 'pointer' }}
            title="같은 namu: itemKey/externalId를 가진 현재 계정 아이템을 1개로 통합합니다."
          >
            중복 정리
          </button>
        </div>

        <button
          onClick={openCreate}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(120,200,255,0.10)', color: 'inherit', cursor: 'pointer' }}
        >
          + 새 아이템
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.95 }}>{treeMsg}</div>

      <div style={{
        ...card,
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 10,
        background: 'rgba(120,200,255,0.06)',
      }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>데이터 범위</div>
          <div style={{ fontWeight: 900 }}>현재 로그인 계정</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>namu 기본 트리</div>
          <div style={{ fontWeight: 900 }}>{scopeStats.namu}개</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>시뮬레이션 생성</div>
          <div style={{ fontWeight: 900 }}>{scopeStats.simulation}개</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>커스텀/기타</div>
          <div style={{ fontWeight: 900 }}>{scopeStats.custom}개</div>
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.72 }}>잠금</div>
          <div style={{ fontWeight: 900 }}>{scopeStats.locked}개</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="이름/ID 검색" style={{ ...input, flex: 1 }} />
        <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} style={input}>
          <option value="all">전체 분류</option>
          <option value="무기">무기</option>
          <option value="방어구">방어구</option>
          <option value="소모품">소모품</option>
          <option value="재료">재료</option>
          <option value="기타">기타</option>
        </select>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.9, padding: '0 6px' }}>
          <input type="checkbox" checked={simOnly} onChange={(e) => { setSimOnly(e.target.checked); setPage(1); }} />
          <span style={{ fontSize: 13 }}>시뮬 생성만</span>
        </label>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          표시 {filtered.length === 0 ? 0 : ((safePage - 1) * pageSize) + 1}
          -{Math.min(filtered.length, safePage * pageSize)} / 검색 결과 {filtered.length}개
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => setPage((v) => Math.max(1, v - 1))}
            disabled={safePage <= 1}
            style={{ ...input, cursor: safePage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            이전
          </button>
          <span style={{ fontSize: 13, opacity: 0.9 }}>{safePage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
            disabled={safePage >= totalPages}
            style={{ ...input, cursor: safePage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            다음
          </button>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={input}>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}개씩</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>이름</th>
              <th style={th}>type</th>
              <th style={th}>슬롯</th>
              <th style={th}>레시피</th>
              <th style={th}>가격</th>
              <th style={th}>희귀도</th>
              <th style={th}>스탯</th>
              <th style={th}>잠금</th>
              <th style={{ ...th, textAlign: 'right' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {status === 'loading' && (
              <tr>
                <td style={td} colSpan={10}>아이템을 불러오는 중입니다.</td>
              </tr>
            )}
            {status !== 'loading' && pagedItems.map((it) => (
              <tr key={String(it._id || it.mongoId || it.id || Math.random())}>
                <td style={td}>
                  <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(it.itemKey || it.externalId || it._id || it.mongoId || it.id || '-')}</div>
                  {((it.itemKey || it.externalId) && (it._id || it.mongoId)) && (
                    <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.65, marginTop: 2 }}>mongo: {String(it._id || it.mongoId)}</div>
                  )}
                </td>
                <td style={td}>{String(it.name ?? it.itemName ?? '-')}</td>
                <td style={td}>{String(it.type ?? it.kind ?? it.category ?? '-')}</td>
                <td style={td}>{formatEquipSlot(it.equipSlot)}</td>
                <td style={td}>
                  {Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0
                    ? `${it.recipe.ingredients.length}개`
                    : '-'}
                </td>
                <td style={td}>{String(it.value ?? it.price ?? it.baseCreditValue ?? it.gold ?? '-')}</td>
                <td style={td}>{String(it.rarity ?? '-')}</td>
                <td style={{ ...td, maxWidth: 220, fontSize: 12 }}>{formatItemStatsSummary(it)}</td>
                <td style={td}>{it.lockedByAdmin ? '🔒' : '-'}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(it)} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'inherit', cursor: 'pointer' }}>편집</button>
                  <button
                    onClick={() => deleteItem(it).catch((e) => alert(String(e?.message || e)))}
                    disabled={deletingIds.has(getItemMongoId(it))}
                    style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,120,120,0.35)', background: 'rgba(255,80,80,0.12)', color: 'inherit', cursor: deletingIds.has(getItemMongoId(it)) ? 'not-allowed' : 'pointer', opacity: deletingIds.has(getItemMongoId(it)) ? 0.55 : 1 }}
                  >
                    {deletingIds.has(getItemMongoId(it)) ? '삭제 중' : '삭제'}
                  </button>
                </td>
              </tr>
            ))}
            {status !== 'loading' && pagedItems.length === 0 && (
              <tr>
                <td style={td} colSpan={10}>
                  <div style={{ display: 'grid', gap: 8, padding: '4px 0' }}>
                    <div style={{ fontWeight: 900 }}>
                      {items.length === 0
                        ? '현재 계정에 아이템이 없습니다.'
                        : '필터 조건에 맞는 아이템이 없습니다.'}
                    </div>
                    <div style={{ opacity: 0.75, lineHeight: 1.45 }}>
                      {items.length === 0
                        ? '어드민 데이터가 계정별로 분리되어 있어서, 이 계정 전용 기본 아이템을 먼저 생성해야 합니다.'
                        : '검색어, 분류, 시뮬 생성만 필터를 확인해 주세요.'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {items.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => generateDefaultTree('missing')}
                          disabled={treeBusy}
                          style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(120,200,255,0.35)', background: 'rgba(120,200,255,0.10)', color: 'inherit', cursor: treeBusy ? 'not-allowed' : 'pointer' }}
                        >
                          {treeBusy ? '생성 중…' : '기본 아이템 트리 생성'}
                        </button>
                      ) : null}
                      {hasActiveFilter ? (
                        <button
                          type="button"
                          onClick={resetFilters}
                          style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'inherit', cursor: 'pointer' }}
                        >
                          필터 초기화
                        </button>
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ItemEditorModal
        open={editorOpen}
        mode={editorMode}
        item={editorItem}
        allItems={items}
        onClose={() => setEditorOpen(false)}
        onSave={saveItem}
      />
    </div>
  );
}
