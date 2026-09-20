const integer = (value, min) => {
  if (value == null || typeof value === 'boolean' || typeof value === 'object'
    || typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min ? number : null;
};

// Preserve invalid drafts for an explicit error; never silently round quantities
// or drop an unselected ingredient before saving the authored recipe.
export function createItemRecipeDraft(raw = {}) {
  return {
    creditsCost: raw?.creditsCost === undefined ? 0 : raw.creditsCost,
    resultQty: raw?.resultQty === undefined ? 1 : raw.resultQty,
    ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.map(row => ({
      itemId: String(row?.itemId?._id ?? row?.itemId ?? row?.id ?? ''),
      qty: row?.qty === undefined ? 1 : row.qty,
    })) : [],
  };
}

export function prepareItemRecipeDraft(raw) {
  const fail = error => ({ ok: false, error });
  if (!raw || !Array.isArray(raw.ingredients) || raw.ingredients.length > 32)
    return fail('제작 재료는 최대 32종류까지 지정할 수 있습니다.');
  const creditsCost = integer(raw.creditsCost, 0), resultQty = integer(raw.resultQty, 1);
  if (creditsCost == null || resultQty == null)
    return fail('제작 비용은 0 이상의 정수, 결과 수량은 1 이상의 정수로 입력해 주세요.');
  const ingredients = [];
  for (const [index, row] of raw.ingredients.entries()) {
    const itemId = String(row?.itemId || '').trim(), qty = integer(row?.qty, 1);
    if (!itemId || qty == null)
      return fail(`${index + 1}번째 재료를 선택하고 수량을 1 이상의 정수로 입력해 주세요.`);
    ingredients.push({ itemId, qty });
  }
  return { ok: true, recipe: { ingredients, resultQty, creditsCost } };
}
