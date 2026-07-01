import { itemDisplayName } from './simulationCommon';

export function getDevGrantDedupeKey(item) {
  const stableKey = String(item?.itemKey || item?.externalId || item?.erCode || '').trim().toLowerCase();
  if (stableKey) return `key:${stableKey}`;
  const tier = Math.max(1, Math.min(6, Math.floor(Number(item?.tier || 1))));
  return [
    'shape',
    itemDisplayName(item).trim().toLowerCase(),
    String(item?.type || '').trim().toLowerCase(),
    String(item?.equipSlot || '').trim().toLowerCase(),
    String(tier),
  ].join('|');
}

export function isPreferredDevGrantItem(next, prev) {
  if (!prev) return true;
  const nextKey = String(next?.itemKey || next?.externalId || '').trim();
  const prevKey = String(prev?.itemKey || prev?.externalId || '').trim();
  if (nextKey && !prevKey) return true;
  if (!nextKey && prevKey) return false;
  const nextSource = String(next?.source || '').toLowerCase();
  const prevSource = String(prev?.source || '').toLowerCase();
  if (nextSource.includes('namu') && !prevSource.includes('namu')) return true;
  if (!nextSource.includes('namu') && prevSource.includes('namu')) return false;
  return String(next?._id || '').localeCompare(String(prev?._id || '')) < 0;
}

export function dedupeDevGrantItems(items) {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item?._id) return;
    const key = getDevGrantDedupeKey(item);
    const prev = map.get(key);
    if (isPreferredDevGrantItem(item, prev)) map.set(key, item);
  });
  return [...map.values()];
}
