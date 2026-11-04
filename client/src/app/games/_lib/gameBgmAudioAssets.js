// This public value is embedded by Next.js at build time; it is not a secret.
const configuredBase = String(process.env.NEXT_PUBLIC_GAME_BGM_AUDIO_BASE_URL || '').trim();
const configuredFormat = String(process.env.NEXT_PUBLIC_GAME_BGM_AUDIO_FORMAT || 'wav').trim();

export function gameBgmAudioUrl(assetKey, base = configuredBase, format = configuredFormat) {
  if (!/^audio\/[a-z0-9-]+\/[a-z0-9-]+\.wav$/.test(assetKey)) {
    throw new Error(`Invalid rendered audio asset key: ${assetKey}`);
  }
  if (format !== 'wav' && format !== 'mp3') throw new Error(`Invalid rendered audio format: ${format}`);
  // assetKey always identifies the original WAV; playback may use its MP3 derivative.
  const playbackKey = assetKey.replace(/\.wav$/, `.${format}`);
  if (!base) return `/${playbackKey}`;
  const parsed = new URL(base);
  if (!/^https:\/\//i.test(base) || parsed.protocol !== 'https:' || parsed.username || parsed.password || /[?#]/.test(base)) {
    throw new Error('Rendered audio base must be an HTTPS URL without credentials, query or fragment');
  }
  return `${parsed.href.replace(/\/+$/, '')}/${playbackKey}`;
}
