import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseName = 'NEXT_PUBLIC_GAME_BGM_AUDIO_BASE_URL';
const formatName = 'NEXT_PUBLIC_GAME_BGM_AUDIO_FORMAT';
const publicRoot = path.join(clientRoot, 'public');
const remoteBase = 'https://example.invalid/music';

async function checkScenario(scenario) {
  // Each scenario imports the real factory in a fresh process, as build-time
  // public configuration must be selected before its first module evaluation.
  if (scenario.invalid) {
    await assert.rejects(import('../src/app/games/_lib/gameBgmRenderedTracks.js'));
    return 0;
  }
  const { gameBgmAudioUrl } = await import('../src/app/games/_lib/gameBgmAudioAssets.js');
  const { GAME_BGM_RENDERED_TRACKS, gameBgmRenderedTrack } = await import('../src/app/games/_lib/gameBgmRenderedTracks.js');
  const { renderedAudioAssetPath, renderedAudioLocalFile } = await import('./lib/rendered-audio-local-assets.mjs');
  const tracks = Object.entries(GAME_BGM_RENDERED_TRACKS);
  assert.equal(tracks.length, 104);
  assert.equal(new Set(tracks.map(([, track]) => track.assetKey)).size, 104);
  const manifests = new Map();
  for (const [theme, track] of tracks) {
    assert.equal(Object.isFrozen(track), true);
    assert.equal(gameBgmRenderedTrack(theme), track);
    assert.match(track.assetKey, /^audio\/[a-z0-9-]+\/[a-z0-9-]+\.wav$/);
    const expectedPlaybackKey = track.assetKey.replace(/\.wav$/, `.${scenario.format}`);
    assert.equal(track.src, `${scenario.base || ''}/${expectedPlaybackKey}`);
    assert.equal(renderedAudioAssetPath(track), `/${track.assetKey}`);
    const expectedLocalFile = path.join(publicRoot, ...track.assetKey.split('/'));
    assert.equal(renderedAudioLocalFile(publicRoot, track), expectedLocalFile);
    const [, folder, file] = track.assetKey.split('/');
    if (!manifests.has(folder)) {
      manifests.set(folder, JSON.parse(await readFile(path.join(publicRoot, 'audio', folder, 'manifest.json'), 'utf8')));
    }
    assert.ok(manifests.get(folder).tracks.some((row) => row.file === file), `Missing original manifest entry: ${track.assetKey}`);
  }
  assert.equal(manifests.size, 14);

  const track = tracks[0][1];
  const originalRoot = path.join(clientRoot, `.missing-rendered-audio-contract-${process.pid}`);
  try {
    process.env.EH_RENDERED_AUDIO_ROOT = originalRoot;
    const originalFile = renderedAudioLocalFile(publicRoot, track);
    assert.equal(originalFile, path.join(originalRoot, ...track.assetKey.split('/').slice(1)));
    // The selected original must be read as-is; a missing relocated original
    // cannot fall back to a public file or fetch a remote playback derivative.
    await assert.rejects(readFile(originalFile), { code: 'ENOENT' });
    for (const invalidRoot of ['', ' ', 'relative/audio']) {
      process.env.EH_RENDERED_AUDIO_ROOT = invalidRoot;
      assert.throws(() => renderedAudioLocalFile(publicRoot, track), /EH_RENDERED_AUDIO_ROOT/);
    }
  } finally {
    delete process.env.EH_RENDERED_AUDIO_ROOT;
  }
  assert.throws(() => renderedAudioAssetPath({ ...track, src: 'https://example.invalid/wrong.mp3' }), /Playback URL/);
  assert.throws(() => renderedAudioLocalFile(publicRoot, { ...track, assetKey: 'audio/../menu.wav' }));

  if (scenario.name === 'default-local-wav') {
    const key = 'audio/eternal-hunger/menu.wav';
    assert.equal(gameBgmAudioUrl(key, ''), `/${key}`);
    assert.equal(gameBgmAudioUrl(key, remoteBase, 'wav'), `${remoteBase}/${key}`);
    assert.equal(gameBgmAudioUrl(key, `${remoteBase}///`, 'mp3'), `${remoteBase}/audio/eternal-hunger/menu.mp3`);
    for (const invalidFormat of ['ogg', 'MP3', '', ' mp3 ', null]) {
      assert.throws(() => gameBgmAudioUrl(key, remoteBase, invalidFormat), /Invalid rendered audio format/);
    }
    for (const invalidKey of ['../menu.wav', 'audio/game/../menu.wav', 'audio/game/menu.mp3', 'audio/game/menu.wav?x', 'audio/game/%2e%2e.wav']) {
      assert.throws(() => gameBgmAudioUrl(invalidKey, remoteBase, 'mp3'), /Invalid rendered audio asset key/);
    }
  }
  return tracks.length;
}

if (process.argv[2] === '--scenario') {
  const mappings = await checkScenario(JSON.parse(process.argv[3]));
  console.log(JSON.stringify({ mappings }));
} else {
  const scenarios = [
    { name: 'default-local-wav', format: 'wav' },
    { name: 'empty-local-wav', baseEnv: '', formatEnv: '', format: 'wav' },
    { name: 'remote-wav', baseEnv: `${remoteBase}/`, base: remoteBase, format: 'wav' },
    { name: 'remote-mp3', baseEnv: `${remoteBase}/`, formatEnv: 'mp3', base: remoteBase, format: 'mp3' },
    { name: 'local-mp3', formatEnv: 'mp3', format: 'mp3' },
    { name: 'trimmed-remote-mp3', baseEnv: ` ${remoteBase}/ `, formatEnv: ' mp3 ', base: remoteBase, format: 'mp3' },
    ...[
      'not-a-url', 'http://example.invalid', '//example.invalid', 'https:example.invalid',
      'https://name:password@example.invalid', 'https://example.invalid/?x=1',
      'https://example.invalid/?', 'https://example.invalid/#section', 'https://example.invalid/#',
    ].map((baseEnv) => ({ name: `invalid-base:${baseEnv}`, baseEnv, invalid: true })),
    ...['ogg', 'MP3', ' '].map((formatEnv) => ({ name: `invalid-format:${JSON.stringify(formatEnv)}`, formatEnv, invalid: true })),
  ];
  let trackMappings = 0;
  for (const scenario of scenarios) {
    const env = { ...process.env };
    for (const name of [baseName, formatName, 'EH_RENDERED_AUDIO_ROOT']) delete env[name];
    if (scenario.baseEnv !== undefined) env[baseName] = scenario.baseEnv;
    if (scenario.formatEnv !== undefined) env[formatName] = scenario.formatEnv;
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--scenario', JSON.stringify(scenario)], {
      cwd: clientRoot, env, encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024,
    });
    assert.equal(result.error, undefined, `${scenario.name}: ${result.error?.message}`);
    assert.equal(result.status, 0, `${scenario.name}: ${result.stderr}`);
    trackMappings += JSON.parse(result.stdout).mappings;
  }
  console.log(JSON.stringify({ passed: true, scenarios: scenarios.length, trackMappings, networkRequests: 0, wavFilesRead: 0, generatedFiles: 0 }));
}
