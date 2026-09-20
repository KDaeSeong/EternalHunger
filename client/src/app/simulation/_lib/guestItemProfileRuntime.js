import { normalizeConsumeEffect, consumeEffectErrorText } from '../../../utils/consumeEffectContract.js';
import { prepareItemRecipeDraft } from '../../../utils/itemRecipeAuthoring.js';

export const GUEST_ITEM_PROFILE_KEY = 'eh_guest_item_profiles_v1';
const MAX_BYTES = 512 * 1024;
const MAX_ITEMS = 128;
const fail = error => ({ ok: false, items: [], error });
const storageOf = storage => storage === undefined ? globalThis.localStorage : storage;
const idOf = item => String(item?._id || '');
const allowedTypes = new Set(['소모품', 'consumable', 'food', '재료', 'material', '무기', 'weapon', '방어구', 'armor', '기타']);

export function normalizeGuestItem(raw, catalog = []) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('아이템 형식을 확인해 주세요.');
  const id = idOf(raw), name = String(raw.name || '').trim();
  const existing = catalog.find(item => idOf(item) === id);
  if (!id || id.length > 180 || (!existing && !/^guest-item-[a-zA-Z0-9-]+$/.test(id))) return fail('이 기기의 아이템 식별자가 올바르지 않습니다.');
  if (!name || name.length > 120 || !allowedTypes.has(raw.type)) return fail('아이템 이름과 분류를 확인해 주세요.');
  const consume = normalizeConsumeEffect(raw.consumeEffect);
  if (!consume.ok) return fail(consumeEffectErrorText(consume));
  if (consume.explicit && !['소모품', 'consumable', 'food'].includes(raw.type)) return fail('사용 효과가 있는 아이템은 소모품으로 분류해 주세요.');
  const copy = { ...structuredClone(existing || {}), _id: id, name, type: raw.type };
  for (const key of ['description', 'rarity', 'equipSlot', 'weaponType', 'archetype', 'externalId']) {
    if (raw[key] !== undefined) copy[key] = String(raw[key]).slice(0, key === 'description' ? 4000 : 180);
  }
  for (const [key, fallback, min] of [['tier', 1, 1], ['stackMax', 1, 1], ['value', 0, 0]]) {
    const value = Number(raw[key] ?? fallback);
    if (!Number.isSafeInteger(value) || value < min) return fail('티어·수량·가격은 유효한 정수여야 합니다.');
    copy[key] = value;
  }
  for (const key of ['tags', 'spawnZones']) {
    if (raw[key] === undefined) continue;
    if (!Array.isArray(raw[key]) || raw[key].length > 100 || raw[key].some(row => typeof row !== 'string' || row.length > 180))
      return fail('태그 또는 출현 지역을 확인해 주세요.');
    copy[key] = [...new Set(raw[key].filter(Boolean))];
  }
  if (raw.stats !== undefined) {
    if (!raw.stats || typeof raw.stats !== 'object' || Array.isArray(raw.stats)
      || Object.entries(raw.stats).some(([key, value]) => !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || !Number.isFinite(Number(value))))
      return fail('아이템 능력치 수치를 확인해 주세요.');
    copy.stats = Object.fromEntries(Object.entries(raw.stats).map(([key, value]) => [key, Number(value)]));
  }
  if (raw.recipe !== undefined) {
    const recipe = raw.recipe;
    if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length > 32) return fail('제작 재료를 확인해 주세요.');
    const checked = prepareItemRecipeDraft({ creditsCost: 0, resultQty: 1, ...recipe });
    if (!checked.ok) return fail(checked.error);
    if (checked.recipe.ingredients.some(row => row.itemId === id))
      return fail('제작 재료와 수량을 확인해 주세요. 자기 자신을 재료로 쓸 수 없습니다.');
    copy.recipe = checked.recipe;
  }
  if (!existing && !copy.recipe?.ingredients?.length)
    return fail('새 아이템은 제작 재료를 한 가지 이상 지정해 주세요. 실제 재료를 모아 제작합니다.');
  copy.consumeEffect = consume.effect;
  copy.localItemProfile = true;
  return { ok: true, item: copy };
}

function validateProfiles(items, builtin) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return fail('이 기기에 저장할 수 있는 아이템은 최대 128개입니다.');
  if (new Set(items.map(idOf)).size !== items.length) return fail('중복된 아이템 식별자가 있습니다.');
  const normalized = items.map(item => normalizeGuestItem(item, builtin));
  const rejected = normalized.find(row => !row.ok);
  if (rejected) return rejected;
  const rows = normalized.map(row => row.item);
  const all = new Map([...builtin, ...rows].map(row => [idOf(row), row]));
  // Reject missing inputs and recipe cycles at authoring time, not mid-match.
  const visiting = new Set(), visited = new Set();
  const walk = id => {
    if (!all.has(id) || visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    if ((all.get(id).recipe?.ingredients || []).some(row => !walk(String(row.itemId)))) return false;
    visiting.delete(id); visited.add(id); return true;
  };
  if (rows.some(row => !walk(idOf(row)))) return fail('제작 재료가 없거나 조합식이 순환합니다. 기존 저장은 유지됩니다.');
  return { ok: true, items: rows };
}

export function readGuestItems(builtin = [], storage) {
  try {
    const text = storageOf(storage)?.getItem(GUEST_ITEM_PROFILE_KEY);
    if (text == null) return { ok: true, items: [] };
    if (text.length > MAX_BYTES) return fail('저장된 아이템 데이터가 너무 큽니다. 원본은 유지됩니다.');
    const parsed = JSON.parse(text);
    if (parsed?.schemaVersion !== 1) return fail('지원하지 않는 아이템 저장 형식입니다. 원본은 유지됩니다.');
    return validateProfiles(parsed.items, builtin);
  } catch { return fail('이 기기의 아이템을 읽지 못했습니다. 저장 공간을 확인해 주세요.'); }
}

function persist(items, builtin, storage) {
  const checked = validateProfiles(items, builtin);
  if (!checked.ok) return checked;
  const serialized = JSON.stringify({ schemaVersion: 1, items: checked.items });
  if (serialized.length > MAX_BYTES) return fail('아이템 저장 용량을 초과했습니다. 기존 저장은 유지됩니다.');
  try {
    const target = storageOf(storage);
    if (!target) return fail('이 기기에 저장할 수 없습니다.');
    target.setItem(GUEST_ITEM_PROFILE_KEY, serialized);
    return checked;
  } catch { return fail('저장하지 못했습니다. 기존 아이템은 유지되며 새 변경은 적용되지 않았습니다.'); }
}

export function saveGuestItem(raw, builtin = [], storage) {
  const previous = readGuestItems(builtin, storage);
  if (!previous.ok) return previous;
  const item = normalizeGuestItem(raw, builtin);
  if (!item.ok) return item;
  return persist([...previous.items.filter(row => idOf(row) !== idOf(item.item)), item.item], builtin, storage);
}

export function removeGuestItem(id, builtin = [], storage) {
  const previous = readGuestItems(builtin, storage);
  if (!previous.ok) return previous;
  return persist(previous.items.filter(row => idOf(row) !== String(id)), builtin, storage);
}

export function mergeGuestItemCatalog(builtin, { includeLocal = true, storage } = {}) {
  const saved = includeLocal ? readGuestItems(builtin, storage) : { ok: true, items: [] };
  if (!saved.ok) throw new Error(saved.error);
  return structuredClone([...new Map([...builtin, ...saved.items].map(row => [idOf(row), row])).values()]);
}
