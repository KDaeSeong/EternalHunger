// Do not let compactIO silently drop invalid rows or turn zero into one.
export function getValidRecipeIngredients(item) {
  const id = String(item?._id || '');
  if (!id || id.startsWith('wpn_') || id.startsWith('eq_') || item?.lockedByAdmin === 'deleted') return null;
  const rows = item?.recipe?.ingredients;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const totals = new Map();
  for (const row of rows) {
    const itemId = typeof row?.itemId === 'string' ? row.itemId : '';
    const rawQty = row?.qty === undefined ? 1 : row.qty;
    const qty = typeof rawQty === 'number' || (typeof rawQty === 'string' && rawQty.trim()) ? Number(rawQty) : NaN;
    const total = (totals.get(itemId) || 0) + qty;
    if (!itemId.trim() || itemId === id || !Number.isSafeInteger(qty) || qty <= 0 || !Number.isSafeInteger(total)) return null;
    totals.set(itemId, total);
  }
  return [...totals].map(([itemId, qty]) => ({ itemId, qty }));
}

export function unavailableGearRecipe(actor, reason, text, itemId = '') {
  const key = `${reason}:${itemId}`;
  const repeated = actor?._gearRecipeNoticeKey === key;
  if (actor && typeof actor === 'object') actor._gearRecipeNoticeKey = key;
  return { changed: false, reason, pvpBonus: 0,
    logs: repeated ? [] : [`⚠️ [${actor?.name || '실험체'}] ${text} (재료·장비 보존)`] };
}
