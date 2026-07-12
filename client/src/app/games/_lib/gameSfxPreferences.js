export const GAME_SFX_PREFERENCE_EVENT = 'kei-game-lab:game-sfx-preference';
export const GAME_SFX_PREFERENCE_PREFIX = 'kei-game-lab:game-sfx:';

export function normalizeGameSfxTheme(theme) {
  const value = String(theme || 'default').trim().toLowerCase();
  return value || 'default';
}

export function gameSfxPreferenceKey(theme) {
  return `${GAME_SFX_PREFERENCE_PREFIX}${normalizeGameSfxTheme(theme)}`;
}

export function readGameSfxPreference(theme, storage = globalThis?.localStorage) {
  try {
    return storage?.getItem(gameSfxPreferenceKey(theme)) !== 'off';
  } catch {
    return true;
  }
}

export function writeGameSfxPreference(theme, enabled, storage = globalThis?.localStorage) {
  const next = Boolean(enabled);
  try {
    storage?.setItem(gameSfxPreferenceKey(theme), next ? 'on' : 'off');
  } catch {
    // Storage availability must not block the current game session.
  }
  return next;
}
