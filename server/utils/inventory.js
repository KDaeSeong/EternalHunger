// server/utils/inventory.js
// 인벤토리 정규화(legacy -> itemId 매핑)

const mongoose = require('mongoose');

function isObjectIdLike(v) {
  return typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);
}

/**
 * name -> itemDoc 맵을 만든다(대소문자 무시)
 * @param {Array<{_id:any,name:string}>} items
 */
function buildItemNameMap(items) {
  const map = new Map();
  for (const it of items || []) {
    if (!it?.name) continue;
    map.set(String(it.name).trim().toLowerCase(), it);
  }
  return map;
}

/**
 * legacy/혼합 형태의 인벤토리를 정규화
 * - qty가 없으면 1
 * - itemId가 없으면 name/id를 이용해 매핑
 * - 동일 아이템(같은 itemId 또는 같은 name)을 하나로 merge
 */
function normalizeInventory(inventory, itemNameMap, { merge = true } = {}) {
  const list = Array.isArray(inventory) ? inventory : [];

  const normalized = list.map((raw) => {
    const it = raw && typeof raw === 'object' ? { ...raw } : { name: String(raw || '') };

    // qty
    const q = Number(it.qty ?? it.quantity ?? 1);
    it.qty = Number.isFinite(q) && q > 0 ? q : 1;
    delete it.quantity;

    // itemId 추정
    if (!it.itemId) {
      // 1) id가 ObjectId처럼 생기면 itemId로 간주
      if (isObjectIdLike(it.id)) it.itemId = it.id;

      // 2) name 기반 매핑
      if (!it.itemId && it.name) {
        const found = itemNameMap?.get(String(it.name).trim().toLowerCase());
        if (found?._id) it.itemId = found._id;
      }
    }

    // ObjectId 캐스팅(가능하면)
    if (it.itemId && typeof it.itemId === 'string' && isObjectIdLike(it.itemId)) {
      it.itemId = new mongoose.Types.ObjectId(it.itemId);
    }

    // name 비었으면 itemNameMap에서 채워 넣기
    if ((!it.name || !String(it.name).trim()) && it.itemId && itemNameMap) {
      // itemId -> name 역매핑은 여기서 안 하고, 호출측에서 필요하면 populate로 해결
      // (name을 꼭 채우고 싶으면 item 리스트를 idMap으로도 만들면 됩니다.)
    }

    return it;
  });

  if (!merge) return normalized;

  // merge duplicates
  const mergedMap = new Map();
  for (const it of normalized) {
    const key = it.itemId ? `id:${String(it.itemId)}` : `name:${String(it.name || it.id || '').trim().toLowerCase()}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...it });
    } else {
      const prev = mergedMap.get(key);
      prev.qty = Number(prev.qty || 1) + Number(it.qty || 1);
      mergedMap.set(key, prev);
    }
  }
  return [...mergedMap.values()];
}

/**
 * inventory에서 특정 itemId를 qty만큼 차감
 * - 스택형/개별형 모두 지원
 * @returns {boolean} 성공 여부
 */
function removeFromInventory(inventory, itemId, qty) {
  const list = Array.isArray(inventory) ? inventory : [];
  const need = Number(qty || 0);
  if (!Number.isFinite(need) || need <= 0) return true;

  let remaining = need;
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i];
    const same = it?.itemId && String(it.itemId) === String(itemId);
    if (!same) continue;

    const have = Number(it.qty ?? 1);
    if (have <= remaining) {
      remaining -= have;
      list.splice(i, 1);
    } else {
      it.qty = have - remaining;
      remaining = 0;
    }
    if (remaining <= 0) break;
  }
  return remaining <= 0;
}

/**
 * inventory에 itemId를 qty만큼 추가(기본: 한 스택으로 쌓기)
 */
function addToInventory(inventory, { itemId, name, qty = 1, tags, type }) {
  const list = Array.isArray(inventory) ? inventory : [];
  const addQty = Number(qty || 0);
  if (!Number.isFinite(addQty) || addQty <= 0) return list;

  const existing = list.find((it) => it?.itemId && String(it.itemId) === String(itemId));
  if (existing) {
    existing.qty = Number(existing.qty ?? 1) + addQty;
  } else {
    list.push({ itemId, name, qty: addQty, tags: tags || [], type: type || 'misc' });
  }
  return list;
}

function countInInventory(inventory, itemId) {
  const list = Array.isArray(inventory) ? inventory : [];
  return list.reduce((sum, it) => {
    if (it?.itemId && String(it.itemId) === String(itemId)) {
      return sum + Number(it.qty ?? 1);
    }
    return sum;
  }, 0);
}

module.exports = {
  buildItemNameMap,
  normalizeInventory,
  removeFromInventory,
  addToInventory,
  countInInventory,
};
