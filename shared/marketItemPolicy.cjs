// One purchase policy for server catalogues, simulation quotes and settlement.
const DEFAULT_KIOSK_ITEM_NAMES = Object.freeze([
  '운석', '생명의 나무', '미스릴', '전술 강화 모듈', 'VF 혈액 샘플', '포스 코어',
]);

function normalizeMarketItemId(value) {
  return String(value?._id || value?.itemId || value || '').trim();
}

function itemName(item) {
  const fallback = normalizeMarketItemId(item?._id || item?.itemId).split(':').at(-1);
  return String(item?.name || item?.text || fallback || '').trim();
}

function compact(value) {
  return String(value || '').toLowerCase().replace(/[\s._-]+/g, '');
}

function isPlainWater(item) {
  return ['물', 'water'].includes(compact(itemName(item)))
    && !item?.equipSlot && !['무기', '방어구', 'weapon', 'armor'].includes(item?.type);
}

function isFoodMarketItem(item) {
  const tags = (Array.isArray(item?.tags) ? item.tags : []).map(tag => String(tag).toLowerCase());
  const type = String(item?.type || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();
  if (['food', 'drink', '음식', '음료'].includes(type)
    || ['food', 'drink'].includes(category)
    || tags.some(tag => ['food', 'drink', 'healthy', 'meat', '음식', '음료'].includes(tag))) return true;
  if (item?.equipSlot || ['무기', '방어구', 'weapon', 'armor'].includes(type)) return false;
  return /음식|고기|빵|치킨|피자|초콜릿|스테이크|사과|food|apple|steak|bread|chicken|pizza|chocolate|meat/i.test(itemName(item));
}

function isMarketItemAllowed(item, source) {
  if (!item || typeof item !== 'object') return false;
  if (isPlainWater(item)) return source === 'drone';
  return !isFoodMarketItem(item);
}

function isDefaultKioskItem(item) {
  if (!isMarketItemAllowed(item, 'kiosk') || item?.equipSlot
    || ['무기', '방어구', 'weapon', 'armor', 'equipment'].includes(item?.type)) return false;
  const names = new Set(DEFAULT_KIOSK_ITEM_NAMES.map(compact));
  const aliases = ['meteor', 'treeoflife', 'lifetree', '생나', 'mythril', 'mithril',
    'tacticalskillmodule', 'tacskillmodule', '혈액팩', '혈팩', 'bloodpack', 'bloodsample', 'vfbloodsample', 'forcecore'];
  if (names.has(compact(itemName(item))) || aliases.includes(compact(itemName(item)))) return true;
  return (Array.isArray(item.tags) ? item.tags : []).some(tag => ['meteor', 'life_tree', 'mithril', 'force_core', 'vf', 'tac_skill_module'].includes(String(tag).toLowerCase()));
}

function resolveCatalogItem(value, findById) {
  const found = findById?.(normalizeMarketItemId(value));
  const populated = value && typeof value === 'object' ? value : null;
  // Full runtime metadata wins, while a display-name-only fallback must not
  // erase the food tags/type supplied by a populated server catalogue.
  return found && (found.type || found.tags || found.category || !populated) ? found : populated || found || null;
}

function isKioskCatalogRowAllowed(row, findById) {
  if (!isMarketItemAllowed(resolveCatalogItem(row?.itemId, findById), 'kiosk')) return false;
  return row?.mode !== 'exchange'
    || isMarketItemAllowed(resolveCatalogItem(row.exchange?.giveItemId, findById), 'kiosk');
}

function visibleKioskCatalog(catalog, findById) {
  return (Array.isArray(catalog) ? catalog : [])
    .map((row, index) => ({ ...row, catalogIndex: Number.isSafeInteger(row?.catalogIndex) ? row.catalogIndex : index }))
    .filter(row => isKioskCatalogRowAllowed(row, findById));
}

module.exports = { DEFAULT_KIOSK_ITEM_NAMES, normalizeMarketItemId, isPlainWater,
  isFoodMarketItem, isMarketItemAllowed, isDefaultKioskItem, isKioskCatalogRowAllowed, visibleKioskCatalog };
