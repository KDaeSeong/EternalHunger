export const GAME_AUDIO_PATH_THEMES = Object.freeze([
  ['eternalhunger', 'eternal'],
  ['simulation', 'eternal'],
  ['twenty-questions', 'twenty'],
  ['dual-academy-tcg', 'academy-duel'],
  ['ba-vanguard', 'vanguard'],
  ['primitive-archive', 'civilization'],
  ['tonkatsu-teacher', 'kitchen'],
  ['schale-idle-rpg', 'idle'],
  ['ba-srpg', 'tactical'],
  ['myanimecraft', 'starleague'],
  ['school-simulator', 'school'],
  ['si-coding-sim', 'coding'],
  ['rail3d-sim', 'rail'],
  ['company-report', 'ledger'],
  ['racing-logos-demo', 'racing'],
]);

export function gameAudioThemeForPath(pathname) {
  const path = String(pathname || '').split('?')[0].toLowerCase();
  const found = GAME_AUDIO_PATH_THEMES.find(([needle]) => path.includes(needle));
  return found?.[1] || '';
}

export function resolveGameAudioTheme(theme, pathname) {
  const explicit = String(theme || '').trim().toLowerCase();
  if (explicit && explicit !== 'auto') return explicit;
  return gameAudioThemeForPath(pathname) || 'default';
}
