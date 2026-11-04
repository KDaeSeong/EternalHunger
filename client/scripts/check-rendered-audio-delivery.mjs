import assert from 'node:assert/strict';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Delivery existence only. PCM/quality checks must still read preserved WAV originals.
export async function checkRenderedAudioDelivery({ publicRoot, tracks, gameBgmAudioUrl, configuration }) {
  assert.ok(path.isAbsolute(publicRoot), 'Audio public root must be absolute');
  assert.ok(Array.isArray(tracks) && tracks.length > 0, 'Rendered audio tracks must not be empty');
  assert.ok(configuration && typeof configuration.base === 'string' && typeof configuration.format === 'string',
    'Selected shared rendered audio configuration is required');
  const { base, format } = configuration;
  const keys = new Set();
  let checkedLocalPlaybackFiles = 0;
  for (const track of tracks) {
    // Reuse the runtime resolver so HTTPS, format and asset-key rules cannot drift.
    const selected = gameBgmAudioUrl(track.assetKey, base, format);
    if (track.src !== undefined) assert.equal(track.src, selected, 'Track URL must match selected shared configuration');
    assert.ok(!keys.has(track.assetKey), `Duplicate rendered audio key: ${track.assetKey}`);
    keys.add(track.assetKey);
    if (base) continue;
    const playbackKey = track.assetKey.replace(/\.wav$/, `.${format}`);
    assert.equal(selected, `/${playbackKey}`, 'Local playback URL must match its selected asset key');
    const target = path.resolve(publicRoot, ...playbackKey.split('/'));
    const relative = path.relative(publicRoot, target);
    assert.ok(relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative), 'Playback path must stay inside public root');
    let current = publicRoot;
    try {
      for (const segment of ['', ...relative.split(path.sep)]) {
        if (segment) current = path.join(current, segment);
        const stat = await lstat(current);
        assert.ok(!stat.isSymbolicLink(), `Linked playback path is not allowed: ${current}`);
        assert.ok(current === target ? stat.isFile() : stat.isDirectory(), `Unexpected playback path type: ${current}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') throw Error(`Missing selected local rendered audio playback file: ${target}`);
      throw error;
    }
    checkedLocalPlaybackFiles++;
  }
  return { pass: true, mode: base ? 'remote' : 'local', format, tracks: tracks.length,
    checkedLocalPlaybackFiles, networkRequests: 0, qualityAcceptance: false };
}

async function main() {
  const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { gameBgmAudioUrl, GAME_BGM_AUDIO_CONFIGURATION } = await import(pathToFileURL(path.join(clientRoot, 'src/app/games/_lib/gameBgmAudioAssets.js')));
  const { GAME_BGM_RENDERED_TRACKS } = await import(pathToFileURL(path.join(clientRoot, 'src/app/games/_lib/gameBgmRenderedTracks.js')));
  const result = await checkRenderedAudioDelivery({ publicRoot: path.join(clientRoot, 'public'),
    tracks: Object.values(GAME_BGM_RENDERED_TRACKS), gameBgmAudioUrl, configuration: GAME_BGM_AUDIO_CONFIGURATION });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
