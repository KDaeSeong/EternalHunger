'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../../utils/api';

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
  const id = externalId ?? mongoId;

  const kind = it.kind ?? it.category ?? it.type ?? it.itemType;
  const price = it.price ?? it.gold ?? it.value ?? it.baseCreditValue ?? it.creditValue;
  const name = it.name ?? it.itemName ?? it.title;
  const rarity = it.rarity ?? it.grade ?? it.rank;

  return {
    ...it,
    id,
    mongoId,
    externalId,
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

function safeJsonParse(v, fallback) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function uniqStrings(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((x) => String(x || '').trim()).filter(Boolean))];
}

function parseTags(text) {
  const s = String(text || '');
  const list = s.split(/[\n,]+/g).map((x) => x.trim()).filter(Boolean);
  return uniqStrings(list);
}

function isSimulationItem(it) {
  if (!it) return false;
  if (String(it.source || '').toLowerCase() === 'simulation') return true;
  if (String(it.externalId || it.id || '').startsWith('wpn_')) return true;
  if (String(it.externalId || it.id || '').startsWith('eq_')) return true;
  const tags = Array.isArray(it.tags) ? it.tags.map(String) : [];
  return tags.includes('simulation') || tags.includes('generated');
}

function ItemEditorModal({ open, mode, item, allItems, onClose, onSave }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const itemOptions = useMemo(() => {
    const list = Array.isArray(allItems) ? allItems : [];
    // mongoId 우선(레시피는 ObjectId 참조)
    const opts = list
      .map((it) => ({
        id: String(it?._id || it?.mongoId || ''),
        externalId: String(it?.externalId || ''),
        name: String(it?.name ?? it?.itemName ?? ''),
        type: String(it?.type ?? it?.kind ?? it?.category ?? ''),
        rarity: String(it?.rarity ?? ''),
        tier: Number(it?.tier ?? 0),
      }))
      .filter((x) => x.id && x.name);
    opts.sort((a, b) => {
      const t = a.type.localeCompare(b.type, 'ko');
      if (t !== 0) return t;
      const r = a.rarity.localeCompare(b.rarity, 'en');
      if (r !== 0) return r;
      const n = a.name.localeCompare(b.name, 'ko');
      if (n !== 0) return n;
      return a.id.localeCompare(b.id);
    });
    return opts;
  }, [allItems]);

  const itemById = useMemo(() => {
    const m = new Map();
    for (const it of itemOptions) m.set(it.id, it);
    return m;
  }, [itemOptions]);

  useEffect(() => {
    if (!open) return;

    const base = item || {};
    const sim = isSimulationItem(base);

    const rawRecipe = base.recipe || {};
    const rawIngredients = Array.isArray(rawRecipe?.ingredients) ? rawRecipe.ingredients : [];
    const ingredients = rawIngredients
      .map((x) => {
        const id = x?.itemId?._id ?? x?.itemId ?? x?.id;
        const qty = toNum(x?.qty, 1);
        return { itemId: id ? String(id) : '', qty: Math.max(1, Math.floor(qty)) };
      })
      .filter((x) => x.itemId);

    setDraft({
      _id: base._id,
      externalId: base.externalId || '',
      name: base.name || '',
      type: base.type || base.kind || '기타',
      rarity: base.rarity || 'common',
      tier: toNum(base.tier, 1),
      stackMax: toNum(base.stackMax, 1),
      value: toNum(base.value ?? base.price ?? base.baseCreditValue, 0),
      tagsText: (Array.isArray(base.tags) ? base.tags.join(', ') : ''),

      equipSlot: base.equipSlot || '',
      weaponType: base.weaponType || '',
      archetype: base.archetype || '',
      description: base.description || '',

      lockedByAdmin: Boolean(base.lockedByAdmin ?? (sim ? true : false)),

      recipe: {
        creditsCost: toNum(rawRecipe?.creditsCost, 0),
        resultQty: Math.max(1, Math.floor(toNum(rawRecipe?.resultQty, 1))),
        ingredients: ingredients.length ? ingredients : [],
      },

      stats: {
        atk: toNum(base.stats?.atk, 0),
        def: toNum(base.stats?.def, 0),
        hp: toNum(base.stats?.hp, 0),
        skillAmp: toNum(base.stats?.skillAmp, 0),
        atkSpeed: toNum(base.stats?.atkSpeed, 0),
        critChance: toNum(base.stats?.critChance, 0),
        cdr: toNum(base.stats?.cdr, 0),
        lifesteal: toNum(base.stats?.lifesteal, 0),
        moveSpeed: toNum(base.stats?.moveSpeed, 0),
      },
    });

    setErr('');
    setBusy(false);
  }, [open, item]);

  if (!open) return null;

  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    padding: 12,
  };
  const modal = {
    width: 'min(980px, 100%)',
    maxHeight: '92vh',
    overflow: 'auto',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#071018',
    padding: 14,
  };
  const input = { padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: '#0b1220', color: '#e5e7eb' };
  const label = { fontSize: 12, opacity: 0.85, marginBottom: 6 };
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 };
  const row2 = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 };

  function setField(key, value) {
    setDraft((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function setStat(key, value) {
    setDraft((prev) => ({
      ...(prev || {}),
      stats: { ...(prev?.stats || {}), [key]: value },
    }));
  }

  function setRecipeField(key, value) {
    setDraft((prev) => ({
      ...(prev || {}),
      recipe: { ...(prev?.recipe || {}), [key]: value },
    }));
  }

  function setIngredient(idx, patch) {
    setDraft((prev) => {
      const cur = Array.isArray(prev?.recipe?.ingredients) ? prev.recipe.ingredients : [];
      const next = cur.map((x, i) => (i === idx ? { ...(x || {}), ...(patch || {}) } : x));
      return {
        ...(prev || {}),
        recipe: { ...(prev?.recipe || {}), ingredients: next },
      };
    });
  }

  function addIngredientRow() {
    setDraft((prev) => {
      const cur = Array.isArray(prev?.recipe?.ingredients) ? prev.recipe.ingredients : [];
      return {
        ...(prev || {}),
        recipe: { ...(prev?.recipe || {}), ingredients: [...cur, { itemId: '', qty: 1 }] },
      };
    });
  }

  function removeIngredientRow(idx) {
    setDraft((prev) => {
      const cur = Array.isArray(prev?.recipe?.ingredients) ? prev.recipe.ingredients : [];
      const next = cur.filter((_, i) => i !== idx);
      return {
        ...(prev || {}),
        recipe: { ...(prev?.recipe || {}), ingredients: next },
      };
    });
  }

  function findFirstIdByName(names = []) {
    const list = Array.isArray(names) ? names : [names];
    for (const nm of list) {
      const hit = itemOptions.find((x) => x.name === nm);
      if (hit) return hit.id;
    }
    // 부분일치도 허용
    for (const nm of list) {
      const hit = itemOptions.find((x) => x.name.includes(String(nm)));
      if (hit) return hit.id;
    }
    return '';
  }

  function pickLowMaterialId() {
    const hit = itemOptions.find((x) => x.type === '재료' && (x.tier <= 1 || x.name.includes('조각') || x.name.includes('가죽') || x.name.includes('나뭇')));
    return hit?.id || '';
  }

  function pickEquipmentIdByRarity(targetRarity) {
    const r = String(targetRarity || '').toLowerCase();
    const hit = itemOptions.find((x) => (x.type === '무기' || x.type === '방어구') && String(x.rarity || '').toLowerCase() === r);
    return hit?.id || '';
  }

  function applyRuleTemplate() {
    if (!draft) return;
    setErr('');

    const r = String(draft.rarity || '').toLowerCase();

    const low = pickLowMaterialId();
    const low2 = pickLowMaterialId();
    const vf = findFirstIdByName(['VF 혈액 샘플', 'VF Blood Sample']);
    const meteor = findFirstIdByName(['운석', 'Meteorite', 'Meteor']);
    const tree = findFirstIdByName(['생명의 나무', 'Tree of Life']);
    const force = findFirstIdByName(['포스 코어', 'Force Core']);
    const mithril = findFirstIdByName(['미스릴', 'Mithril']);

    // 규칙:
    // - 하급 재료 2개 -> 일반
    // - 일반 장비 1 + 하급 재료 1 -> 희귀
    // - 희귀 장비 1 + 하급 재료 1 -> 영웅
    // - 하급 재료 1 + (운석/생나/포스코어/미스릴) -> 전설
    // - 하급 재료 1 + VF -> 초월
    if (r === 'common' || r === 'normal' || r === '일반') {
      setRecipeField('ingredients', [
        { itemId: low || '', qty: 1 },
        { itemId: low2 || low || '', qty: 1 },
      ].filter((x) => x.itemId));
      return;
    }

    if (r === 'rare' || r === '희귀') {
      const base = pickEquipmentIdByRarity('common');
      setRecipeField('ingredients', [
        { itemId: base || '', qty: 1 },
        { itemId: low || '', qty: 1 },
      ].filter((x) => x.itemId));
      return;
    }

    if (r === 'hero' || r === '영웅') {
      const base = pickEquipmentIdByRarity('rare');
      setRecipeField('ingredients', [
        { itemId: base || '', qty: 1 },
        { itemId: low || '', qty: 1 },
      ].filter((x) => x.itemId));
      return;
    }

    if (r === 'legendary' || r === '전설') {
      const special = meteor || tree || force || mithril || '';
      setRecipeField('ingredients', [
        { itemId: low || '', qty: 1 },
        { itemId: special, qty: 1 },
      ].filter((x) => x.itemId));
      return;
    }

    if (r === 'transcendent' || r === 'mythic' || r === '초월') {
      setRecipeField('ingredients', [
        { itemId: low || '', qty: 1 },
        { itemId: vf || '', qty: 1 },
      ].filter((x) => x.itemId));
      return;
    }

    setErr('이 희귀도에는 규칙 템플릿이 정의되어 있지 않아. (common/rare/hero/legendary/transcendent)');
  }

  async function handleSave() {
    if (!draft) return;
    setErr('');

    const name = String(draft.name || '').trim();
    if (!name) {
      setErr('이름(name)은 필수야.');
      return;
    }

    const payload = {
      externalId: String(draft.externalId || '').trim() || undefined,
      name,
      type: String(draft.type || '기타'),
      rarity: String(draft.rarity || 'common'),
      tier: Math.max(1, Math.floor(toNum(draft.tier, 1))),
      stackMax: Math.max(1, Math.floor(toNum(draft.stackMax, 1))),
      value: Math.max(0, Math.floor(toNum(draft.value, 0))),
      tags: parseTags(draft.tagsText),
      equipSlot: String(draft.equipSlot || ''),
      weaponType: String(draft.weaponType || ''),
      archetype: String(draft.archetype || ''),
      description: String(draft.description || ''),
      lockedByAdmin: Boolean(draft.lockedByAdmin),
      recipe: {
        creditsCost: Math.max(0, Math.floor(toNum(draft.recipe?.creditsCost, 0))),
        resultQty: Math.max(1, Math.floor(toNum(draft.recipe?.resultQty, 1))),
        ingredients: (Array.isArray(draft.recipe?.ingredients) ? draft.recipe.ingredients : [])
          .map((x) => ({
            itemId: String(x?.itemId || '').trim(),
            qty: Math.max(1, Math.floor(toNum(x?.qty, 1))),
          }))
          .filter((x) => x.itemId),
      },
      stats: {
        atk: toNum(draft.stats?.atk, 0),
        def: toNum(draft.stats?.def, 0),
        hp: toNum(draft.stats?.hp, 0),
        skillAmp: toNum(draft.stats?.skillAmp, 0),
        atkSpeed: toNum(draft.stats?.atkSpeed, 0),
        critChance: toNum(draft.stats?.critChance, 0),
        cdr: toNum(draft.stats?.cdr, 0),
        lifesteal: toNum(draft.stats?.lifesteal, 0),
        moveSpeed: toNum(draft.stats?.moveSpeed, 0),
      },
    };

    Object.keys(payload).forEach((k) => {
      if (payload[k] === undefined) delete payload[k];
    });

    setBusy(true);
    try {
      await onSave(payload, draft._id);
      onClose();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{mode === 'create' ? '새 아이템 추가' : '아이템 편집'}</div>
          <button onClick={onClose} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'inherit', cursor: 'pointer' }}>닫기</button>
        </div>

        <div style={{ marginTop: 12, ...grid }}>
          <div>
            <div style={label}>이름</div>
            <input value={draft?.name || ''} onChange={(e) => setField('name', e.target.value)} style={{ ...input, width: '100%' }} />
          </div>

          <div>
            <div style={label}>분류(type)</div>
            <select value={draft?.type || '기타'} onChange={(e) => setField('type', e.target.value)} style={{ ...input, width: '100%' }}>
              <option value="무기">무기</option>
              <option value="방어구">방어구</option>
              <option value="소모품">소모품</option>
              <option value="재료">재료</option>
              <option value="기타">기타</option>
            </select>
          </div>

          <div>
            <div style={label}>희귀도(rarity)</div>
            <input value={draft?.rarity || ''} onChange={(e) => setField('rarity', e.target.value)} placeholder="common / rare / epic ..." style={{ ...input, width: '100%' }} />
          </div>

          <div>
            <div style={label}>티어(tier)</div>
            <input type="number" value={draft?.tier ?? 1} onChange={(e) => setField('tier', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
          </div>

          <div>
            <div style={label}>가격(value)</div>
            <input type="number" value={draft?.value ?? 0} onChange={(e) => setField('value', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
          </div>

          <div>
            <div style={label}>스택 최대(stackMax)</div>
            <input type="number" value={draft?.stackMax ?? 1} onChange={(e) => setField('stackMax', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
          </div>
        </div>

        <div style={{ marginTop: 10, ...row2 }}>
          <div>
            <div style={label}>태그(tags) (콤마 구분)</div>
            <input value={draft?.tagsText || ''} onChange={(e) => setField('tagsText', e.target.value)} placeholder="simulation, generated" style={{ ...input, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'end', gap: 10 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.95 }}>
              <input type="checkbox" checked={Boolean(draft?.lockedByAdmin)} onChange={(e) => setField('lockedByAdmin', e.target.checked)} />
              <span style={{ fontSize: 13 }}>관리자 잠금(시뮬 덮어쓰기 방지)</span>
            </label>
          </div>
        </div>

        <div style={{ marginTop: 12, ...grid }}>
          <div>
            <div style={label}>장비 슬롯(equipSlot)</div>
            <input value={draft?.equipSlot || ''} onChange={(e) => setField('equipSlot', e.target.value)} placeholder="weapon/head/clothes/arm/shoes" style={{ ...input, width: '100%' }} />
          </div>
          <div>
            <div style={label}>무기 타입(weaponType)</div>
            <input value={draft?.weaponType || ''} onChange={(e) => setField('weaponType', e.target.value)} style={{ ...input, width: '100%' }} />
          </div>
          <div>
            <div style={label}>아키타입(archetype)</div>
            <input value={draft?.archetype || ''} onChange={(e) => setField('archetype', e.target.value)} style={{ ...input, width: '100%' }} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>스탯(stats)</div>
          <div style={grid}>
            {[
              ['atk', '공격'],
              ['def', '방어'],
              ['hp', '체력'],
              ['skillAmp', '스킬증폭'],
              ['atkSpeed', '공속'],
              ['critChance', '치명'],
              ['cdr', '쿨감'],
              ['lifesteal', '흡혈'],
              ['moveSpeed', '이속'],
            ].map(([k, labelKo]) => (
              <div key={k}>
                <div style={label}>{labelKo} ({k})</div>
                <input type="number" value={draft?.stats?.[k] ?? 0} onChange={(e) => setStat(k, safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 900 }}>조합식(recipe)</div>
            <button
              onClick={applyRuleTemplate}
              type="button"
              style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(120,200,255,0.10)', color: 'inherit', cursor: 'pointer' }}
              title="요청한 규칙(하급2/장비+하급/특수재료/VF)에 맞춰 레시피를 자동으로 채웁니다. 이후 수동 수정 가능."
            >
              규칙 템플릿 자동 채우기
            </button>
          </div>

          <div style={{ marginTop: 10, ...row2 }}>
            <div>
              <div style={label}>제작 비용(creditsCost)</div>
              <input type="number" value={draft?.recipe?.creditsCost ?? 0} onChange={(e) => setRecipeField('creditsCost', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
            </div>
            <div>
              <div style={label}>결과 수량(resultQty)</div>
              <input type="number" value={draft?.recipe?.resultQty ?? 1} onChange={(e) => setRecipeField('resultQty', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, opacity: 0.9 }}>재료(ingredients)</div>
              <button
                onClick={addIngredientRow}
                type="button"
                style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'inherit', cursor: 'pointer' }}
              >
                + 재료 추가
              </button>
            </div>

            <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              {(Array.isArray(draft?.recipe?.ingredients) ? draft.recipe.ingredients : []).map((ing, idx) => {
                const chosen = ing?.itemId ? itemById.get(String(ing.itemId)) : null;
                return (
                  <div key={`${idx}-${String(ing?.itemId || 'x')}`} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 84px', gap: 8, alignItems: 'center' }}>
                    <select
                      value={String(ing?.itemId || '')}
                      onChange={(e) => setIngredient(idx, { itemId: e.target.value })}
                      style={{ ...input, width: '100%' }}
                    >
                      <option value="">(아이템 선택)</option>
                      {itemOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          [{opt.type}/{opt.rarity}] {opt.name}{opt.externalId ? ` (${opt.externalId})` : ''}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={ing?.qty ?? 1}
                      onChange={(e) => setIngredient(idx, { qty: safeJsonParse(e.target.value, e.target.value) })}
                      style={{ ...input, width: '100%' }}
                      min={1}
                    />

                    <button
                      type="button"
                      onClick={() => removeIngredientRow(idx)}
                      style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,120,120,0.35)', background: 'rgba(255,80,80,0.12)', color: 'inherit', cursor: 'pointer' }}
                      title={chosen ? `${chosen.name} 제거` : '제거'}
                    >
                      제거
                    </button>
                  </div>
                );
              })}

              {(Array.isArray(draft?.recipe?.ingredients) ? draft.recipe.ingredients : []).length === 0 && (
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  아직 조합식이 없어. “+ 재료 추가”로 직접 만들거나, “규칙 템플릿 자동 채우기”를 눌러봐.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={label}>설명(description)</div>
          <textarea value={draft?.description || ''} onChange={(e) => setField('description', e.target.value)} rows={4} style={{ ...input, width: '100%', resize: 'vertical' }} />
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          <div>Mongo ID: <span style={{ opacity: 0.95 }}>{draft?._id || '(새 아이템)'}</span></div>
          <div>External ID: <span style={{ opacity: 0.95 }}>{draft?.externalId || '-'}</span></div>
        </div>

        {err && <div style={{ marginTop: 10, color: '#ffb4b4' }}>⚠️ {err}</div>}

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'end', gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'inherit', cursor: busy ? 'not-allowed' : 'pointer' }}>취소</button>
          <button onClick={handleSave} disabled={busy} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(120,255,180,0.35)', background: 'rgba(80,255,160,0.10)', color: 'inherit', cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ItemsAdmin() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [simOnly, setSimOnly] = useState(false);
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

  async function generateDefaultTree(mode = 'missing') {
    if (treeBusy) return;
    setTreeBusy(true);
    setTreeMsg('');
    try {
      const data = await apiPost('/admin/items/generate-default-tree', { mode });
      setTreeMsg(`✅ ${data?.message || '완료'} (created:${data?.summary?.createdCount ?? 0}, recipe:${data?.summary?.recipeUpdatedCount ?? 0})`);
      await reloadItems();
    } catch (e) {
      setTreeMsg(`⚠️ 기본 아이템 트리 생성 실패: ${String(e?.message || e)}`);
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
    if (id) {
      await apiPut(`/admin/items/${id}`, payload);
    } else {
      await apiPost('/admin/items', payload);
    }
    await reloadItems();
  }

  async function deleteItem(it) {
    const id = it?._id || it?.mongoId;
    if (!id) return;
    const name = String(it?.name || it?.itemName || '아이템');
    const ok = window.confirm(`정말 삭제할까?\n\n- ${name}`);
    if (!ok) return;

    await apiDelete(`/admin/items/${id}`);
    await reloadItems();
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

        <button
          onClick={openCreate}
          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(120,200,255,0.10)', color: 'inherit', cursor: 'pointer' }}
        >
          + 새 아이템
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.95 }}>{treeMsg}</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름/ID 검색" style={{ ...input, flex: 1 }} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
          <option value="all">전체 분류</option>
          <option value="무기">무기</option>
          <option value="방어구">방어구</option>
          <option value="소모품">소모품</option>
          <option value="재료">재료</option>
          <option value="기타">기타</option>
        </select>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.9, padding: '0 6px' }}>
          <input type="checkbox" checked={simOnly} onChange={(e) => setSimOnly(e.target.checked)} />
          <span style={{ fontSize: 13 }}>시뮬 생성만</span>
        </label>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>이름</th>
              <th style={th}>type</th>
              <th style={th}>레시피</th>
              <th style={th}>가격</th>
              <th style={th}>희귀도</th>
              <th style={th}>잠금</th>
              <th style={{ ...th, textAlign: 'right' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={String(it._id || it.mongoId || it.id || Math.random())}>
                <td style={td}>
                  <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(it.externalId || it._id || it.mongoId || it.id || '-')}</div>
                  {(it.externalId && (it._id || it.mongoId)) && (
                    <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.65, marginTop: 2 }}>mongo: {String(it._id || it.mongoId)}</div>
                  )}
                </td>
                <td style={td}>{String(it.name ?? it.itemName ?? '-')}</td>
                <td style={td}>{String(it.type ?? it.kind ?? it.category ?? '-')}</td>
                <td style={td}>
                  {Array.isArray(it?.recipe?.ingredients) && it.recipe.ingredients.length > 0
                    ? `${it.recipe.ingredients.length}개`
                    : '-'}
                </td>
                <td style={td}>{String(it.value ?? it.price ?? it.baseCreditValue ?? it.gold ?? '-')}</td>
                <td style={td}>{String(it.rarity ?? '-')}</td>
                <td style={td}>{it.lockedByAdmin ? '🔒' : '-'}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(it)} style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'inherit', cursor: 'pointer' }}>편집</button>
                  <button onClick={() => deleteItem(it).catch((e) => alert(String(e?.message || e)))} style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 10, border: '1px solid rgba(255,120,120,0.35)', background: 'rgba(255,80,80,0.12)', color: 'inherit', cursor: 'pointer' }}>삭제</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td style={td} colSpan={8}>검색 결과가 없어.</td>
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
