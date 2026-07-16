export const GAME_BGM_PREFERENCE_EVENT = 'kei-game-lab:game-bgm-preference';
export const GAME_BGM_ENABLED_KEY = 'kei-game-lab:game-bgm:enabled';
export const GAME_BGM_VOLUME_KEY = 'kei-game-lab:game-bgm:volume';
export const DEFAULT_GAME_BGM_VOLUME = 0.42;

export function normalizeGameBgmVolume(value, fallback = DEFAULT_GAME_BGM_VOLUME) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.min(1, Math.max(0, Number(fallback) || 0));
  return Math.min(1, Math.max(0, parsed));
}

export function readGameBgmEnabled(storage = globalThis?.localStorage) {
  try {
    return storage?.getItem(GAME_BGM_ENABLED_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeGameBgmEnabled(enabled, storage = globalThis?.localStorage) {
  const next = Boolean(enabled);
  try {
    storage?.setItem(GAME_BGM_ENABLED_KEY, next ? 'on' : 'off');
  } catch {
    // Storage availability must not block the current game session.
  }
  return next;
}

export function readGameBgmVolume(storage = globalThis?.localStorage) {
  try {
    return normalizeGameBgmVolume(storage?.getItem(GAME_BGM_VOLUME_KEY));
  } catch {
    return DEFAULT_GAME_BGM_VOLUME;
  }
}

export function writeGameBgmVolume(volume, storage = globalThis?.localStorage) {
  const next = normalizeGameBgmVolume(volume);
  try {
    storage?.setItem(GAME_BGM_VOLUME_KEY, String(next));
  } catch {
    // Storage availability must not block the current game session.
  }
  return next;
}
