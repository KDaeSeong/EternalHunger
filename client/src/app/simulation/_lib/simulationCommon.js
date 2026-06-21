export function safeTags(item) {
  return Array.isArray(item?.tags) ? item.tags : [];
}

export function itemDisplayName(item) {
  return item?.name || item?.text || item?.itemId?.name || '알 수 없는 아이템';
}

export function resolveRewardDropEntry(entry, publicItems, itemNameById) {
  const raw = entry && typeof entry === 'object' ? entry : null;
  if (!raw) return null;
  const rawItem = raw?.item && typeof raw.item === 'object' ? raw.item : null;
  const itemId = String(raw?.itemId || raw?.id || raw?._id || rawItem?._id || '');
  if (!itemId) return null;
  const catalogItem = (Array.isArray(publicItems) ? publicItems : []).find((x) => String(x?._id || '') === itemId) || null;
  const qty = Math.max(1, Number(raw?.qty || raw?.count || 1));
  return {
    itemId,
    qty,
    item: catalogItem || rawItem || {
      _id: itemId,
      name: String(raw?.name || itemNameById?.[itemId] || '아이템'),
      type: String(raw?.type || rawItem?.type || '재료'),
      tags: Array.isArray(rawItem?.tags) ? rawItem.tags : [],
    },
  };
}

export function normalizeRewardDropEntries(entries, publicItems, itemNameById) {
  const rawList = Array.isArray(entries) ? entries : (entries ? [entries] : []);
  return rawList
    .map((entry) => resolveRewardDropEntry(entry, publicItems, itemNameById))
    .filter(Boolean);
}

export function itemIcon(item) {
  const t = String(item?.type || '').toLowerCase();
  const tags = safeTags(item);
  if (tags.includes('heal') || tags.includes('medical')) return '🚑';
  if (tags.includes('meat')) return '🥩';
  if (String(item?.name || '').includes('치킨')) return '🍗';
  if (t === 'food' || tags.includes('food') || tags.includes('healthy')) return '🍎';
  if (t === 'weapon' || item?.type === '무기') return '⚔️';
  if (item?.type === '방어구') return '🛡️';
  return '📦';
}

export function shuffleArray(list, rng = Math.random) {
  const arr = Array.isArray(list) ? [...list] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shortText(s, maxLen = 8) {
  const str = String(s || '');
  if (str.length <= maxLen) return str;
  return str.slice(0, Math.max(0, maxLen - 1)) + '…';
}

export function hash32(str) {
  const s = String(str || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

export function extractActorNameFromLog(text) {
  const t = String(text || '');
  const m = t.match(/\[([^\]]+)\]/);
  return m ? String(m[1] || '').trim() : '';
}

export function compactIO(list) {
  const map = new Map();
  (Array.isArray(list) ? list : []).forEach((x) => {
    if (!x?.itemId) return;
    const id = String(x.itemId);
    const qty = Math.max(1, Number(x.qty || 1));
    map.set(id, (map.get(id) || 0) + qty);
  });
  return [...map.entries()].map(([itemId, qty]) => ({ itemId, qty }));
}

export function uniqStr(list) {
  const out = [];
  const s = new Set();
  for (const v of (Array.isArray(list) ? list : [])) {
    const k = String(v || '').trim();
    if (!k) continue;
    if (s.has(k)) continue;
    s.add(k);
    out.push(k);
  }
  return out;
}

export function randInt(min, max) {
  const a = Math.floor(Number(min || 0));
  const b = Math.floor(Number(max || 0));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function pickWeighted(list) {
  const arr = Array.isArray(list) ? list : [];
  const total = arr.reduce((sum, x) => sum + Math.max(0, Number(x?.weight || 1)), 0);
  if (!(total > 0)) return null;
  let r = Math.random() * total;
  for (const x of arr) {
    r -= Math.max(0, Number(x?.weight || 1));
    if (r <= 0) return x;
  }
  return arr[arr.length - 1] || null;
}

export function clampTier4(v) {
  const n = Math.floor(Number(v || 1));
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.min(6, Math.max(1, n));
}

export function tierLabelKo(tier) {
  const t = clampTier4(tier);
  if (t === 6) return '초월';
  if (t === 5) return '전설';
  if (t === 4) return '영웅';
  if (t === 3) return '희귀';
  if (t === 2) return '고급';
  return '일반';
}

export function crateTypeLabel(crateType) {
  const k = String(crateType || '').toLowerCase();
  if (k === 'route_material') return '루트 재료';
  if (k === 'route_equipment') return '루트 장비';
  if (k === 'food') return '음식 상자';
  if (k === 'legendary_material') return '전설 재료 상자';
  if (k === 'transcend_pick') return '초월 장비 선택 상자';
  // legacy/기타
  if (k.includes('legendary')) return '전설 재료 상자';
  return '상자';
}

export function normalizeMatchKey(v) {
  // NOTE: 정규식 문자 클래스 내 '-'는 범위로 해석될 수 있으니 끝으로 옮기거나 이스케이프한다.
  return String(v || '').toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·・_.(),-]/g, '');
}

export function findItemByKeywords(publicItems, keywords) {
  const list = Array.isArray(publicItems) ? publicItems : [];
  const keys = (Array.isArray(keywords) ? keywords : [])
    .map((k) => normalizeMatchKey(k))
    .filter(Boolean);
  if (!keys.length) return null;
  return (
    list.find((it) => {
      const name = normalizeMatchKey(it?.name || it?.text || '');
      return keys.some((k) => name.includes(k));
    }) || null
  );
}
