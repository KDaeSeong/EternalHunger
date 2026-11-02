'use client';

import { useMemo, useState } from 'react';
import ConsumeEffectFields from './ConsumeEffectFields';
import EquipmentEffectFields from './EquipmentEffectFields';
import { createEquipmentEffectDraft, prepareEquipmentEffectDraft } from '../../../../utils/equipmentEffectAuthoring.js';
import { createConsumeEffectDraft, prepareConsumeEffectDraft } from '../../../../utils/consumeEffectAuthoring.js';
import { buildItemStatFields, ITEM_STAT_FIELDS } from '../../../../utils/itemStatAuthoring.js';
import { createItemRecipeDraft, prepareItemRecipeDraft } from '../../../../utils/itemRecipeAuthoring.js';
import {
  ARMOR_SLOT_VALUES,
  EQUIP_SLOT_OPTIONS,
  isSimulationItem,
  normalizeEquipSlot,
  parseTags,
  safeJsonParse,
  toNum,
} from './itemsAdminUtils';

function buildDraftFromItem(item) {
  const base = item || {};
  const sim = isSimulationItem(base);

  return {
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
    consumeDraft: createConsumeEffectDraft(base.consumeEffect),
    equipmentDraft: createEquipmentEffectDraft(base.equipmentEffects),
    lockedByAdmin: Boolean(base.lockedByAdmin ?? (sim ? true : false)),
    recipe: createItemRecipeDraft(base.recipe),
    ...buildItemStatFields(base),
  };
}

export default function ItemEditorModal({ open, mode, item, allItems, onClose, onSave, localMode = false }) {
  if (!open) return null;
  const modalKey = `${mode}:${String(item?._id || item?.mongoId || item?.id || 'new')}`;
  return (
    <ItemEditorModalBody
      key={modalKey}
      mode={mode}
      item={item}
      allItems={allItems}
      localMode={localMode}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function ItemEditorModalBody({ mode, item, allItems, onClose, onSave, localMode }) {
  const [draft, setDraft] = useState(() => buildDraftFromItem(item));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const itemOptions = useMemo(() => {
    const list = Array.isArray(allItems) ? allItems : [];
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
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 };
  const row2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 10 };

  function setField(key, value) {
    setDraft((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function setType(value) {
    setDraft((prev) => {
      const nextType = String(value || '기타');
      const currentSlot = normalizeEquipSlot(prev?.equipSlot);
      let nextSlot = currentSlot;
      let nextWeaponType = prev?.weaponType || '';
      if (nextType === '무기') {
        nextSlot = 'weapon';
      } else if (nextType === '방어구') {
        if (nextSlot === 'weapon') nextSlot = '';
        nextWeaponType = '';
      } else {
        nextSlot = '';
        nextWeaponType = '';
      }
      return { ...(prev || {}), type: nextType, equipSlot: nextSlot, weaponType: nextWeaponType };
    });
  }

  function setEquipSlot(value) {
    setDraft((prev) => {
      const nextSlot = normalizeEquipSlot(value);
      const nextType = nextSlot === 'weapon' ? '무기' : (nextSlot ? '방어구' : (prev?.type || '기타'));
      return {
        ...(prev || {}),
        type: nextType,
        equipSlot: nextSlot,
        weaponType: nextSlot === 'weapon' ? (prev?.weaponType || '') : '',
      };
    });
  }

  function setStat(key, value) {
    setDraft((prev) => ({
      ...(prev || {}),
      ...buildItemStatFields(draft),
    };

    const consume = prepareConsumeEffectDraft(draft.consumeDraft);
    if (!consume.ok) { setErr(consume.error); return; }
    if (consume.effect && !['소모품', 'consumable', 'food'].includes(type)) {
      setErr('사용 효과를 저장하려면 분류를 소모품으로 선택해 주세요.');
      return;
    }
    payload.consumeEffect = consume.effect;
    const equipment = prepareEquipmentEffectDraft(draft.equipmentDraft);
    if (!equipment.ok) { setErr(equipment.error); return; }
    if (equipment.effects.length && !['무기', '방어구'].includes(type)) {
      setErr('파열 효과를 저장하려면 분류를 무기 또는 방어구로 선택해 주세요.');
      return;
    }
    payload.equipmentEffects = equipment.effects;

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
    <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={mode === 'create' ? '새 아이템 추가' : '아이템 편집'} style={{ ...modal, color: '#e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{mode === 'create' ? '새 아이템 추가' : '아이템 편집'}</div>
          <button onClick={onClose} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'inherit', cursor: 'pointer' }}>닫기</button>
        </div>

        <div style={{ marginTop: 12, ...grid }}>
          <div>
            <div style={label}>이름</div>
            <input aria-label="아이템 이름" value={draft?.name || ''} onChange={(e) => setField('name', e.target.value)} style={{ ...input, width: '100%' }} />
          </div>
          <div>
            <div style={label}>분류</div>
            <select aria-label="아이템 분류" value={draft?.type || '기타'} onChange={(e) => setType(e.target.value)} style={{ ...input, width: '100%' }}>
              <option value="무기">무기</option>
              <option value="방어구">방어구</option>
              <option value="소모품">소모품</option>
              <option value="재료">재료</option>
              <option value="기타">기타</option>
            </select>
          </div>
          {!localMode && <div>
            <div style={label}>등급 표시</div>
            <input value={draft?.rarity || ''} onChange={(e) => setField('rarity', e.target.value)} placeholder="common / rare / epic ..." style={{ ...input, width: '100%' }} />
          </div>}
          <div>
            <div style={label}>아이템 단계</div>
            <input aria-label="아이템 단계" type="number" value={draft?.tier ?? 1} onChange={(e) => setField('tier', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
          </div>
          {!localMode && <div>
            <div style={label}>가격</div>
            <input type="number" value={draft?.value ?? 0} onChange={(e) => setField('value', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
          </div>}
          {!localMode && <div>
            <div style={label}>묶음 수량</div>
            <input type="number" value={draft?.stackMax ?? 1} onChange={(e) => setField('stackMax', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
          </div>}
        </div>
        {localMode && <p style={{ fontSize: 12, marginTop: 10, color: '#b5cddd' }}>가방의 묶음 수량 한도는 경기 규칙을 따릅니다. 이 화면은 계정 상점의 가격을 변경하지 않습니다.</p>}

        {!localMode && <div style={{ marginTop: 10, ...row2 }}>
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
        </div>}

        {(!localMode || ['무기', '방어구'].includes(draft.type)) && <div style={{ marginTop: 12, ...grid }}>
          <div>
            <div style={label}>장착 부위</div>
            <select aria-label="장착 부위" value={normalizeEquipSlot(draft?.equipSlot)} onChange={(e) => setEquipSlot(e.target.value)} style={{ ...input, width: '100%' }}>
              {EQUIP_SLOT_OPTIONS.map((opt) => (
                <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {(!localMode || draft.type === '무기') && <div>
            <div style={label}>무기 종류</div>
            <input aria-label="무기 종류" value={draft?.weaponType || ''} onChange={(e) => setField('weaponType', e.target.value)} style={{ ...input, width: '100%' }} />
          </div>}
          {!localMode && <div>
            <div style={label}>아키타입(archetype)</div>
            <input value={draft?.archetype || ''} onChange={(e) => setField('archetype', e.target.value)} style={{ ...input, width: '100%' }} />
          </div>}
        </div>}

        {(!localMode || ['무기', '방어구'].includes(draft.type)) && <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>장착 능력치</div>
          <p style={{ fontSize: 12, opacity: 0.8 }}>공속은 초당 추가 공격 횟수입니다. 치명·쿨감·흡혈·이속 비율·방어 관통 비율은 0.1이 10%입니다.</p>
          <div style={grid}>
            {ITEM_STAT_FIELDS.map(([k, labelKo]) => (
              <div key={k}>
                <div style={label}>{labelKo}{localMode ? '' : ` (${k})`}</div>
                <input aria-label={labelKo} type="number" step="any" value={draft?.stats?.[k] ?? 0} onChange={(e) => setStat(k, safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
              </div>
            ))}
          </div>
        </div>}

        {(['소모품', 'consumable', 'food'].includes(draft.type) || draft.consumeDraft?.enabled) &&
          <ConsumeEffectFields draft={draft.consumeDraft} onChange={value => setField('consumeDraft', value)} />}
        {(['무기', '방어구'].includes(draft.type) || draft.equipmentDraft?.enabled) &&
          <EquipmentEffectFields draft={draft.equipmentDraft} onChange={value => setField('equipmentDraft', value)} />}

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 900 }}>제작 방법</div>
            {!localMode && <button
              onClick={applyRuleTemplate}
              type="button"
              style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(120,200,255,0.10)', color: 'inherit', cursor: 'pointer' }}
              title="요청한 규칙(하급2/장비+하급/특수재료/VF)에 맞춰 레시피를 자동으로 채웁니다. 이후 수동 수정 가능."
            >
              규칙 템플릿 자동 채우기
            </button>}
          </div>

          <div style={{ marginTop: 10, ...row2 }}>
            <div>
              <div style={label}>제작 비용</div>
              <input aria-label="제작 비용" type="number" value={draft?.recipe?.creditsCost ?? 0} onChange={(e) => setRecipeField('creditsCost', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
            </div>
            <div>
              <div style={label}>한 번에 만드는 수량</div>
              <input aria-label="제작 결과 수량" type="number" value={draft?.recipe?.resultQty ?? 1} onChange={(e) => setRecipeField('resultQty', safeJsonParse(e.target.value, e.target.value))} style={{ ...input, width: '100%' }} />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, opacity: 0.9 }}>필요한 재료</div>
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
                  <div key={`${idx}-${String(ing?.itemId || 'x')}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 70px 60px', gap: 8, alignItems: 'center' }}>
                    <select
                      aria-label={`재료 ${idx + 1}`}
                      value={String(ing?.itemId || '')}
                      onChange={(e) => setIngredient(idx, { itemId: e.target.value })}
                      style={{ ...input, width: '100%' }}
                    >
                      <option value="">(아이템 선택)</option>
                      {itemOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {localMode ? `${opt.name} · ${opt.type}` : `[${opt.type}/${opt.rarity}] ${opt.name}${opt.externalId ? ` (${opt.externalId})` : ''}`}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`재료 ${idx + 1} 수량`}
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
                  “+ 재료 추가”로 제작 방법을 지정해 주세요. 새 아이템은 재료를 모아 제작하며, 내장 아이템의 기존 획득 장소는 유지됩니다.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={label}>설명</div>
          <textarea value={draft?.description || ''} onChange={(e) => setField('description', e.target.value)} rows={4} style={{ ...input, width: '100%', resize: 'vertical' }} />
        </div>

        {!localMode && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          <div>Mongo ID: <span style={{ opacity: 0.95 }}>{draft?._id || '(새 아이템)'}</span></div>
          <div>External ID: <span style={{ opacity: 0.95 }}>{draft?.externalId || '-'}</span></div>
        </div>}

        {err && <div role="alert" style={{ marginTop: 10, color: '#ffb4b4' }}>⚠️ {err}</div>}

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
