// client/src/utils/hallOfFame.js

export const HOF_SYNC_EVENT = 'eh:hof-sync';
export const HOF_SYNC_KEY = 'eh_hof_sync_ts';
export const LEGACY_HOF_KEY = 'eh_local_hof_v1';

export function getHallOfFameUsername(userLike) {
  return String(userLike?.username || userLike?.id || 'guest');
}

export function getHallOfFameStorageKey(userLike) {
  return `eh_hof_${getHallOfFameUsername(userLike)}`;
}

export function normalizeHallOfFameState(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const charsSrc = src?.chars && typeof src.chars === 'object' ? src.chars : {};
  const chars = {};
  Object.entries(charsSrc).forEach(([charId, value]) => {
    if (!charId) return;
    const entry = value && typeof value === 'object' ? value : {};
    chars[String(charId)] = {
      name: entry?.name || String(charId),
      wins: Math.max(0, Number(entry?.wins || 0) || 0),
      kills: Math.max(0, Number(entry?.kills || 0) || 0),
      assists: Math.max(0, Number(entry?.assists || 0) || 0),
    };
  });
  return {
    chars,
    _migratedFromPlayerV1: Boolean(src?._migratedFromPlayerV1),
    updatedAt: Number(src?.updatedAt || 0) || 0,
  };
}

export function readHallOfFameState(userLike) {
  if (typeof window === 'undefined') return normalizeHallOfFameState(null);
  try {
    const raw = window.localStorage.getItem(getHallOfFameStorageKey(userLike));
    return normalizeHallOfFameState(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeHallOfFameState(null);
  }
}

export function summarizeHallOfFameTop3(state) {
  const normalized = normalizeHallOfFameState(state);
  const arr = Object.values(normalized.chars).map((c) => ({
    name: c?.name || '알 수 없음',
    totalWins: Math.max(0, Number(c?.wins || 0) || 0),
    totalKills: Math.max(0, Number(c?.kills || 0) || 0),
    totalAssists: Math.max(0, Number(c?.assists || 0) || 0),
  }));
  return {
    wins: [...arr].filter((x) => x.totalWins > 0).sort((a, b) => ((b.totalWins - a.totalWins) || (b.totalKills - a.totalKills) || String(a.name).localeCompare(String(b.name)))).slice(0, 3),
    kills: [...arr].filter((x) => x.totalKills > 0 || x.totalAssists > 0).sort((a, b) => ((b.totalKills - a.totalKills) || (b.totalAssists - a.totalAssists) || String(a.name).localeCompare(String(b.name)))).slice(0, 3),
  };
}

export function emitHallOfFameSync(userLike, extra = {}) {
  if (typeof window === 'undefined') return;
  const detail = {
    username: getHallOfFameUsername(userLike),
    key: getHallOfFameStorageKey(userLike),
    at: Date.now(),
    ...extra,
  };
  try {
    window.localStorage.setItem(HOF_SYNC_KEY, JSON.stringify(detail));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(HOF_SYNC_EVENT, { detail }));
  } catch {}
}

export function writeHallOfFameState(userLike, updater, extra = {}) {
  if (typeof window === 'undefined') return normalizeHallOfFameState(null);
  try {
    const current = readHallOfFameState(userLike);
    const nextRaw = typeof updater === 'function' ? updater(current) : updater;
    const next = normalizeHallOfFameState(nextRaw);
    next.updatedAt = Date.now();
    window.localStorage.setItem(getHallOfFameStorageKey(userLike), JSON.stringify(next));
    emitHallOfFameSync(userLike, extra);
    return next;
  } catch {
    return normalizeHallOfFameState(null);
  }
}
