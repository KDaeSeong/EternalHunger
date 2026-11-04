// Public build-time delivery configuration; no bucket or account credentials.
export const DEFAULT_GAME_BGM_AUDIO_BASE_URL = 'https://pub-38fd672431c94a81bb1c23804abd21da.r2.dev';
export const DEFAULT_GAME_BGM_AUDIO_FORMAT = 'mp3';
export const GAME_BGM_AUDIO_CONFIGURATION = Object.freeze({
  base: String(process.env.NEXT_PUBLIC_GAME_BGM_AUDIO_BASE_URL ?? DEFAULT_GAME_BGM_AUDIO_BASE_URL).trim(),
  format: String(process.env.NEXT_PUBLIC_GAME_BGM_AUDIO_FORMAT ?? DEFAULT_GAME_BGM_AUDIO_FORMAT).trim(),
});

export function gameBgmAudioUrl(assetKey, base = GAME_BGM_AUDIO_CONFIGURATION.base, format = GAME_BGM_AUDIO_CONFIGURATION.format) {
  if (!/^audio\/[a-z0-9-]+\/[a-z0-9-]+\.wav$/.test(assetKey)) {
    throw new Error(`Invalid rendered audio asset key: ${assetKey}`);
  }
  if (format !== 'wav' && format !== 'mp3') throw new Error(`Invalid rendered audio format: ${format}`);
  // The canonical key always identifies the original WAV, including its audio/ prefix.
  const playbackKey = assetKey.replace(/\.wav$/, `.${format}`);
  if (!base) return `/${playbackKey}`;
  const parsed = new URL(base);
  if (!/^https:\/\//i.test(base) || parsed.protocol !== 'https:' || parsed.username || parsed.password || /[?#]/.test(base)) {
    throw new Error('Rendered audio base must be an HTTPS URL without credentials, query or fragment');
  }
  // A remote base is the audio root itself. Preserve any configured path prefix.
  return `${parsed.href.replace(/\/+$/, '')}/${playbackKey.slice('audio/'.length)}`;
}
