export const MAX_RENDERED_TRACK_CACHE = 8;

export function gameBgmTransitionMode(hasCurrentSession, hasRenderedTrack) {
  if (!hasRenderedTrack) return 'synth';
  return hasCurrentSession ? 'hold-current' : 'synth-fallback';
}

export function readRenderedTrackCache(cache, key) {
  if (!(cache instanceof Map) || !cache.has(key)) return null;
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

export function rememberRenderedTrack(cache, key, value, maxEntries = MAX_RENDERED_TRACK_CACHE) {
  if (!(cache instanceof Map) || !key) return value;
  const limit = Math.max(1, Math.floor(Number(maxEntries) || MAX_RENDERED_TRACK_CACHE));
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  return value;
}
