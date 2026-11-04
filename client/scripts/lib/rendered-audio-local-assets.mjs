import assert from 'node:assert/strict';
import path from 'node:path';
import { gameBgmAudioUrl } from '../../src/app/games/_lib/gameBgmAudioAssets.js';

// The override points to the single preserved directory containing game folders,
// e.g. <audio root>/eternal-hunger/menu.wav. Manifests stay in client/public.
export function renderedAudioAssetPath(track) {
  assert.match(track.assetKey, /^audio\/[a-z0-9-]+\/[a-z0-9-]+\.wav$/);
  assert.equal(track.src, gameBgmAudioUrl(track.assetKey), 'Playback URL must match its stable asset key');
  return `/${track.assetKey}`;
}

export function renderedAudioLocalFile(publicRoot, track) {
  renderedAudioAssetPath(track);
  const override = process.env.EH_RENDERED_AUDIO_ROOT;
  if (override !== undefined) {
    assert.ok(override.trim() && path.isAbsolute(override), 'EH_RENDERED_AUDIO_ROOT must be a nonempty absolute audio directory');
  }
  const audioRoot = override === undefined ? path.join(publicRoot, 'audio') : override;
  // Read only this location; readFile must fail when the original is absent.
  // A remote response or a missing-file skip never substitutes for PCM checks.
  return path.join(audioRoot, ...track.assetKey.slice('audio/'.length).split('/'));
}
