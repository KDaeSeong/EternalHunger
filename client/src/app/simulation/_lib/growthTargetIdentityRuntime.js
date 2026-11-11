const catalogKeyCache = new WeakMap();

// Opening declarations search every alias in original catalogue order, even
// when the first row is not a craftable or usable equipment target.
export function getOpeningGrowthTargetByKey(items, key) {
  if (!catalogKeyCache.has(items)) {
    const byKey = new Map();
    for (const item of items) {
      for (const alias of [item.itemKey, item.externalId, item._id]) {
        const value = String(alias ?? '').trim();
        if (value && !byKey.has(value)) byKey.set(value, item);
      }
    }
    catalogKeyCache.set(items, byKey);
  }
  return catalogKeyCache.get(items).get(String(key ?? '').trim());
}
