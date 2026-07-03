export const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

export const EQUIP_SLOT_OPTIONS = [
  { value: '', label: '미지정' },
  { value: 'weapon', label: '무기' },
  { value: 'head', label: '머리' },
  { value: 'clothes', label: '옷' },
  { value: 'arm', label: '팔' },
  { value: 'shoes', label: '신발' },
];

export const EQUIP_SLOT_VALUES = new Set(EQUIP_SLOT_OPTIONS.map((x) => x.value));
export const ARMOR_SLOT_VALUES = new Set(['head', 'clothes', 'arm', 'shoes']);

export function getItemMongoId(it) {
  return String(it?._id || it?.mongoId || '').trim();
}

export function safeJsonParse(v, fallback) {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function uniqStrings(list) {
  return [...new Set((Array.isArray(list) ? list : []).map((x) => String(x || '').trim()).filter(Boolean))];
}

export function parseTags(text) {
  const s = String(text || '');
  const list = s.split(/[\n,]+/g).map((x) => x.trim()).filter(Boolean);
  return uniqStrings(list);
}

export function normalizeEquipSlot(value) {
  const v = String(value || '').trim();
  return EQUIP_SLOT_VALUES.has(v) ? v : '';
}

export function formatEquipSlot(value) {
  const v = normalizeEquipSlot(value);
  return EQUIP_SLOT_OPTIONS.find((opt) => opt.value === v)?.label || '미지정';
}

export function isSimulationItem(it) {
  if (!it) return false;
  if (String(it.source || '').toLowerCase() === 'simulation') return true;
  if (String(it.externalId || it.id || '').startsWith('wpn_')) return true;
  if (String(it.externalId || it.id || '').startsWith('eq_')) return true;
  const tags = Array.isArray(it.tags) ? it.tags.map(String) : [];
  return tags.includes('simulation') || tags.includes('generated');
}

export function formatItemStatsSummary(it) {
  const stats = it?.stats && typeof it.stats === 'object' ? it.stats : {};
  const fields = [
    ['atk', '공'],
    ['def', '방'],
    ['hp', '체'],
    ['skillAmp', '스증'],
    ['atkSpeed', '공속'],
    ['critChance', '치확'],
    ['cdr', '쿨감'],
    ['lifesteal', '흡혈'],
    ['moveSpeed', '이속'],
    ['armorPen', '방관'],
    ['adaptiveForce', '맞춤'],
  ];
  const parts = fields
    .map(([key, label]) => {
      const n = Number(stats?.[key] || 0);
      if (!Number.isFinite(n) || n === 0) return '';
      return `${label} ${n}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : '-';
}
