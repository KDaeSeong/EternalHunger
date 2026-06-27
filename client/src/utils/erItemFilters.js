function normalizeItemText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·・_.(),-]/g, '');
}

export function isAglaiaGiftItem(item) {
  const name = normalizeItemText(item?.name || item?.text || '');
  const key = normalizeItemText(item?.key || item?.itemKey || item?.externalId || item?.code || '');
  return name.includes('아글라이아의선물') || key.includes('aglaia') || key.includes('아글라이아의선물');
}

export function isItemExcludedFromFieldFarming(item) {
  return isAglaiaGiftItem(item);
}
