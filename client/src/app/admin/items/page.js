'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminTabs from '../../../components/AdminTabs';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../utils/api';

const TYPES = ['무기', '방어구', '소모품', '재료', '기타'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const defaultModifiers = () => ({
  STR: 0,
  AGI: 0,
  INT: 0,
  MEN: 0,
  LUK: 0,
  DEX: 0,
  SHT: 0,
  END: 0,
});

const emptyForm = () => ({
  name: '',
  type: '무기',
  rarity: 'common',
  tier: 1,
  value: 0,
  stackMax: 1,
  tagsText: '',
  description: '',
  modifiers: defaultModifiers(),
  recipeEnabled: false,
  recipeMaterials: [{ itemId: '', qty: 1 }],
  recipeCreditsCost: 0,
  recipeResultQty: 1,
});

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toTags(text) {
  return String(text || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function modsFrom(item) {
  const base = defaultModifiers();
  const m = item?.modifiers || item?.mods || {};
  for (const k of Object.keys(base)) {
    base[k] = toNum(m?.[k], 0);
  }
  return base;
}

function recipeFrom(item) {
  const r = item?.recipe || {};
  const enabled = Boolean(r.enabled);
  const materials = Array.isArray(r.materials) ? r.materials : [];
  return {
    recipeEnabled: enabled,
    recipeMaterials:
      materials.length > 0
        ? materials.map((m) => ({ itemId: String(m.itemId || ''), qty: toNum(m.qty, 1) }))
        : [{ itemId: '', qty: 1 }],
    recipeCreditsCost: toNum(r.creditsCost, 0),
    recipeResultQty: toNum(r.resultQty, 1),
  };
}

export default function AdminItemsPage() {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');

  // 추가/수정 폼
  const [createForm, setCreateForm] = useState(() => emptyForm());
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(() => emptyForm());

  // 필터
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setMessage('');
      const data = await apiGet('/admin/items');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
      setMessage(e.message);
    }
  };

  const filteredItems = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (typeFilter && it.type !== typeFilter) return false;
      if (rarityFilter && it.rarity !== rarityFilter) return false;
      if (!needle) return true;
      const s = `${it.name || ''} ${it.description || ''}`.toLowerCase();
      return s.includes(needle);
    });
  }, [items, q, typeFilter, rarityFilter]);

  const startEdit = (item) => {
    setEditId(item._id);
    setEditForm({
      name: item.name || '',
      type: item.type || '무기',
      rarity: item.rarity || 'common',
      tier: toNum(item.tier, 1),
      value: toNum(item.value, 0),
      stackMax: toNum(item.stackMax, 1),
      tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : item.tagsText || '',
      description: item.description || '',
      modifiers: modsFrom(item),
      ...recipeFrom(item),
    });
    // 위로 스크롤(편집 카드가 바로 보이게)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm(emptyForm());
  };

  const saveCreate = async () => {
    try {
      setMessage('');
      if (!createForm.name.trim()) throw new Error('이름을 입력하세요.');

      const payload = {
        name: createForm.name.trim(),
        type: createForm.type,
        rarity: createForm.rarity,
        tier: toNum(createForm.tier, 1),
        value: toNum(createForm.value, 0),
        stackMax: toNum(createForm.stackMax, 1),
        tags: toTags(createForm.tagsText),
        description: createForm.description || '',
        modifiers: createForm.modifiers,
        recipe: {
          enabled: Boolean(createForm.recipeEnabled),
          materials: (createForm.recipeMaterials || [])
            .map((m) => ({ itemId: m.itemId, qty: toNum(m.qty, 1) }))
            .filter((m) => m.itemId),
          creditsCost: toNum(createForm.recipeCreditsCost, 0),
          resultQty: toNum(createForm.recipeResultQty, 1),
        },
      };

      await apiPost('/admin/items', payload);
      setMessage('추가 완료');
      setCreateForm(emptyForm());
      fetchItems();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const saveEdit = async () => {
    try {
      setMessage('');
      if (!editId) return;
      if (!editForm.name.trim()) throw new Error('이름을 입력하세요.');

      const payload = {
        name: editForm.name.trim(),
        type: editForm.type,
        rarity: editForm.rarity,
        tier: toNum(editForm.tier, 1),
        value: toNum(editForm.value, 0),
        stackMax: toNum(editForm.stackMax, 1),
        tags: toTags(editForm.tagsText),
        description: editForm.description || '',
        modifiers: editForm.modifiers,
        recipe: {
          enabled: Boolean(editForm.recipeEnabled),
          materials: (editForm.recipeMaterials || [])
            .map((m) => ({ itemId: m.itemId, qty: toNum(m.qty, 1) }))
            .filter((m) => m.itemId),
          creditsCost: toNum(editForm.recipeCreditsCost, 0),
          resultQty: toNum(editForm.recipeResultQty, 1),
        },
      };

      await apiPut(`/admin/items/${editId}`, payload);
      setMessage('수정 완료');
      cancelEdit();
      fetchItems();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const removeItem = async (id) => {
    if (!confirm('삭제할까요?')) return;
    try {
      setMessage('');
      await apiDelete(`/admin/items/${id}`);
      setMessage('삭제 완료');
      fetchItems();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const renderForm = (form, setForm, onSubmit, submitLabel, extraActions) => {
    const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const setMod = (k, v) =>
      setForm((p) => ({ ...p, modifiers: { ...p.modifiers, [k]: toNum(v, 0) } }));

    const addMaterial = () =>
      setForm((p) => ({ ...p, recipeMaterials: [...p.recipeMaterials, { itemId: '', qty: 1 }] }));

    const setMaterial = (idx, key, v) =>
      setForm((p) => {
        const next = [...p.recipeMaterials];
        next[idx] = { ...next[idx], [key]: key === 'qty' ? toNum(v, 1) : v };
        return { ...p, recipeMaterials: next };
      });

    const removeMaterial = (idx) =>
      setForm((p) => {
        const next = [...p.recipeMaterials];
        next.splice(idx, 1);
        return { ...p, recipeMaterials: next.length ? next : [{ itemId: '', qty: 1 }] };
      });

    return (
      <div className="admin-card">
        <div className="admin-section-title" style={{ marginBottom: 12 }}>
          {submitLabel}
        </div>

        <div className="admin-row">
          <div className="admin-field" style={{ flex: 1, minWidth: 260 }}>
            <label>이름</label>
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="아이템 이름" />
          </div>

          <div className="admin-field" style={{ width: 180 }}>
            <label>타입</label>
            <select value={form.type} onChange={(e) => setField('type', e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field" style={{ width: 180 }}>
            <label>희귀도</label>
            <select value={form.rarity} onChange={(e) => setField('rarity', e.target.value)}>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-row">
          <div className="admin-field" style={{ width: 180 }}>
            <label>티어</label>
            <input type="number" value={form.tier} onChange={(e) => setField('tier', e.target.value)} />
          </div>
          <div className="admin-field" style={{ width: 180 }}>
            <label>가치(value)</label>
            <input type="number" value={form.value} onChange={(e) => setField('value', e.target.value)} />
          </div>
          <div className="admin-field" style={{ width: 180 }}>
            <label>최대 스택</label>
            <input type="number" value={form.stackMax} onChange={(e) => setField('stackMax', e.target.value)} />
          </div>
          <div className="admin-field" style={{ flex: 1, minWidth: 260 }}>
            <label>태그(쉼표 구분)</label>
            <input value={form.tagsText} onChange={(e) => setField('tagsText', e.target.value)} placeholder="예: heal, food, book" />
          </div>
        </div>

        <div className="admin-field">
          <label>설명</label>
          <textarea rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="아이템 설명" />
        </div>

        <div className="admin-divider" />

        <div className="admin-section-title" style={{ marginBottom: 10 }}>
          능력치 보정
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {Object.keys(form.modifiers).map((k) => (
            <div className="admin-field" key={k}>
              <label>{k}</label>
              <input type="number" value={form.modifiers[k]} onChange={(e) => setMod(k, e.target.value)} />
            </div>
          ))}
        </div>

        <div className="admin-divider" />

        <div className="admin-row" style={{ alignItems: 'center' }}>
          <div className="admin-section-title" style={{ margin: 0 }}>
            조합 레시피
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.recipeEnabled} onChange={(e) => setField('recipeEnabled', e.target.checked)} />
            사용
          </label>
        </div>

        {form.recipeEnabled && (
          <>
            <div className="admin-row">
              <div className="admin-field" style={{ width: 220 }}>
                <label>레시피 크레딧 비용</label>
                <input type="number" value={form.recipeCreditsCost} onChange={(e) => setField('recipeCreditsCost', e.target.value)} />
              </div>
              <div className="admin-field" style={{ width: 220 }}>
                <label>결과 수량</label>
                <input type="number" value={form.recipeResultQty} onChange={(e) => setField('recipeResultQty', e.target.value)} />
              </div>
            </div>

            <div style={{ color: 'rgba(232,236,255,0.72)', marginBottom: 8, fontSize: 13 }}>
              조합 재료를 등록하세요. (아이템 선택 + 수량)
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {form.recipeMaterials.map((m, idx) => (
                <div key={idx} className="admin-row">
                  <div className="admin-field" style={{ flex: 1, minWidth: 220 }}>
                    <label>재료 아이템</label>
                    <select value={m.itemId} onChange={(e) => setMaterial(idx, 'itemId', e.target.value)}>
                      <option value="">선택</option>
                      {items.map((it) => (
                        <option key={it._id} value={it._id}>
                          {it.name} ({it.type}/{it.rarity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-field" style={{ width: 180 }}>
                    <label>수량</label>
                    <input type="number" value={m.qty} onChange={(e) => setMaterial(idx, 'qty', e.target.value)} />
                  </div>
                  <button className="admin-btn danger" onClick={() => removeMaterial(idx)} style={{ height: 44, alignSelf: 'end' }}>
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <button className="admin-btn" onClick={addMaterial}>
                + 재료 추가
              </button>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button className="admin-btn" onClick={onSubmit}>
            {submitLabel}
          </button>
          {extraActions}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="admin-topbar">
        <h1 style={{ margin: 0, fontSize: 22 }}>아이템 관리</h1>
        <AdminTabs />
      </div>

      {message && (
        <div className="admin-card admin-alert" style={{ marginTop: 12 }}>
          {message}
        </div>
      )}

      {/* 수정 모드(페이지 내부) */}
      {editId &&
        renderForm(editForm, setEditForm, saveEdit, '수정 저장', (
          <button className="admin-btn" onClick={cancelEdit}>
            취소
          </button>
        ))}

      {/* 추가 */}
      {renderForm(createForm, setCreateForm, saveCreate, '새 아이템 추가')}

      {/* 목록 */}
      <div className="admin-card">
        <div className="admin-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="admin-section-title" style={{ margin: 0 }}>
            아이템 목록 ({filteredItems.length})
          </div>

          <div className="admin-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색(이름/설명)"
              style={{
                width: 220,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(8,12,20,0.6)',
                color: 'rgba(232,236,255,0.92)',
                outline: 'none',
              }}
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                width: 160,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(8,12,20,0.6)',
                color: 'rgba(232,236,255,0.92)',
                outline: 'none',
              }}
            >
              <option value="">타입 전체</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value)}
              style={{
                width: 160,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(8,12,20,0.6)',
                color: 'rgba(232,236,255,0.92)',
                outline: 'none',
              }}
            >
              <option value="">희귀도 전체</option>
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-divider" />

        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>타입</th>
                <th>희귀도</th>
                <th>티어</th>
                <th>value</th>
                <th>stackMax</th>
                <th>tags</th>
                <th>recipe</th>
                <th style={{ width: 200 }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it._id}>
                  <td>{it.name}</td>
                  <td>{it.type}</td>
                  <td>{it.rarity}</td>
                  <td>{it.tier}</td>
                  <td>{it.value}</td>
                  <td>{it.stackMax}</td>
                  <td>{Array.isArray(it.tags) ? it.tags.join(', ') : ''}</td>
                  <td>{it.recipe?.enabled ? 'Y' : '-'}</td>
                  <td>
                    <button className="admin-btn" onClick={() => startEdit(it)} style={{ marginRight: 8 }}>
                      수정
                    </button>
                    <button className="admin-btn danger" onClick={() => removeItem(it._id)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ color: 'rgba(232,236,255,0.65)' }}>
                    아이템이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
